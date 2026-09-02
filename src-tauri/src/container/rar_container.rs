//! RAR container implementation.
//!
//! # Performance Constraints
//!
//! `unrar`'s `OpenArchive` is not `Send` and has no random access: reaching a page means
//! walking the headers from wherever the cursor stands. A reader is owned by one thread
//! for the life of a book, so it keeps that cursor between pages and a forward read is a
//! step rather than a rescan. On a solid archive the difference is the whole cost —
//! every member sits in one compressed block, so skipping to page N decompresses
//! everything before it.

use unrar::{Archive, CursorBeforeHeader, OpenArchive, Process};

use std::{collections::HashMap, sync::Arc};

use crate::{
    container::{
        archive_path,
        traits::{Container, PageReader},
    },
    error::{Error, Result},
    image::types::Image,
};

/// An implementation of the `Container` trait for reading content from RAR archive files.
pub struct RarContainer {
    /// The file path of the RAR container.
    path: String,
    /// A naturally sorted list of the image leaf names in the opened folder.
    entries: Vec<String>,
    /// Maps each leaf name back to its full path inside the archive, which is what the
    /// archive headers carry. Shared with every reader rather than copied into each one.
    entry_to_path: Arc<HashMap<String, String>>,
    /// Every archive member's position in header order, including the directories a
    /// reader has to walk past. This is what lets a reader tell "still ahead of me" from
    /// "already behind me" without walking to the end to find out.
    member_order: Arc<HashMap<String, usize>>,
    /// Whether all members share one compressed block, in which case a second reader
    /// would only repeat the first one's decompression.
    is_solid: bool,
}

impl Container for RarContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn is_directory(&self) -> bool {
        false
    }

    fn max_readers(&self) -> usize {
        if self.is_solid {
            // One compressed block: a second reader decompresses the same prefix again
            // rather than doing anything the first is not already doing.
            1
        } else {
            usize::MAX
        }
    }

    fn open_reader(&self) -> Result<Box<dyn PageReader>> {
        Ok(Box::new(self.reader()))
    }
}

/// A reader over one RAR archive, holding its cursor between pages.
///
/// Reading the book in order therefore costs one walk over the archive rather than one
/// per page. A backward target has to reopen and re-walk, which on a solid archive is
/// the expensive direction — but it is the right trade: the page a reader is waiting for
/// always outranks scan throughput.
struct RarReader {
    path: String,
    entry_to_path: Arc<HashMap<String, String>>,
    member_order: Arc<HashMap<String, usize>>,
    /// `None` before the first read, and after anything leaves the cursor's position
    /// unknown — the end of the archive, or a failed read.
    cursor: Option<OpenArchive<Process, CursorBeforeHeader>>,
    /// How many headers the cursor has walked past.
    position: usize,
    /// How many headers this reader has walked in total, across every read.
    ///
    /// The cost of a RAR page is the headers between it and the previous one, so this is
    /// the number that says whether a reading order is a single pass or a rescan per
    /// page. `position` cannot show that: it is reset by every reopen, and so reads the
    /// same either way.
    #[cfg(test)]
    walked: usize,
}

impl RarReader {
    /// Opens the archive again, with the cursor back at the first header.
    fn reopen(&mut self) -> Result<()> {
        self.cursor = Some(open(&self.path)?);
        self.position = 0;
        Ok(())
    }

    /// Walks forward to `wanted` and reads it, or reaches the end without finding it.
    ///
    /// `read`, `skip` and `read_header` each consume the archive and hand back a new
    /// value, so the cursor is moved out and put back rather than borrowed. Anything that
    /// fails part-way therefore leaves it `None`, and the next read reopens — a lost
    /// position is a slow read, never a wrong one.
    fn walk_to(&mut self, wanted: &str) -> Result<Option<Vec<u8>>> {
        while let Some(cursor) = self.cursor.take() {
            let Some(at_file) = cursor.read_header()? else {
                return Ok(None);
            };
            let filename = at_file.entry().filename.to_string_lossy().to_string();
            self.position += 1;
            #[cfg(test)]
            {
                self.walked += 1;
            }
            if filename == wanted {
                let (data, rest) = at_file.read()?;
                self.cursor = Some(rest);
                return Ok(Some(data));
            }
            self.cursor = Some(at_file.skip()?);
        }
        Ok(None)
    }
}

impl PageReader for RarReader {
    fn read_page(&mut self, entry: &str) -> Result<Vec<u8>> {
        let wanted = self
            .entry_to_path
            .get(entry)
            .ok_or_else(|| Error::EntryNotFound(format!("Entry not found in RAR: {entry}")))?
            .clone();
        // An unlisted name would compare as "ahead of everything", which only costs a
        // reopen before the walk below reports it missing.
        let target = self.member_order.get(&wanted).copied().unwrap_or(usize::MAX);

        if self.cursor.is_none() || self.position > target {
            self.reopen()?;
        }
        if let Some(data) = self.walk_to(&wanted)? {
            return Ok(data);
        }

        // The cursor ran out before reaching it. Bookkeeping can only ever be wrong in
        // this direction, so one restart from the top settles whether the entry is really
        // absent rather than merely behind us.
        self.reopen()?;
        self.walk_to(&wanted)?
            .ok_or_else(|| Error::EntryNotFound(format!("Entry not found: {wanted}")))
    }
}

impl RarContainer {
    /// Creates a new `RarContainer` from the RAR file at the specified path.
    ///
    /// This constructor opens the RAR archive, filters for supported image formats,
    /// and sorts the resulting file list in natural order.
    ///
    /// # Arguments
    ///
    /// * `path` - The path to the RAR file.
    /// * `inner_dir` - The folder inside the archive to open as the book, `/`-separated.
    ///   Empty opens the archive root.
    ///
    /// # Returns
    ///
    /// A `Result` containing a new `RarContainer` instance on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the RAR file cannot be opened or an error occurs
    /// while reading its entries.
    pub fn new(path: &str, inner_dir: &str) -> Result<Self> {
        let archive = Archive::new(path).open_for_listing()?;
        let is_solid = archive.is_solid();

        let mut filenames: Vec<String> = Vec::new();
        let mut member_order: HashMap<String, usize> = HashMap::new();
        for (position, entry_result) in archive.enumerate() {
            let entry = entry_result?;
            let filename = entry.filename.to_string_lossy().to_string();
            // Directories are indexed too: a reader walks past their headers, so leaving
            // them out would make every position after one of them too small.
            //
            // RAR permits duplicate names, and a reader stops at the first match, so the
            // first position wins — the same rule `collect_entries` applies.
            member_order.entry(filename.clone()).or_insert(position);
            if entry.is_file() {
                filenames.push(filename);
            }
        }

        let (entries, entry_to_path) = collect_entries(filenames.into_iter(), inner_dir);

        Ok(Self {
            path: path.to_string(),
            entries,
            entry_to_path: Arc::new(entry_to_path),
            member_order: Arc::new(member_order),
            is_solid,
        })
    }

    /// Builds a reader with its cursor unopened.
    ///
    /// Separate from [`Container::open_reader`] so a test can hold the concrete type and
    /// see where the cursor has reached, which is the whole subject of this file.
    fn reader(&self) -> RarReader {
        RarReader {
            path: self.path.clone(),
            entry_to_path: self.entry_to_path.clone(),
            member_order: self.member_order.clone(),
            cursor: None,
            position: 0,
            #[cfg(test)]
            walked: 0,
        }
    }

}

/// Builds the naturally-sorted image entry list for one folder inside the archive.
///
/// Only entries sitting *directly* inside `inner_dir` are kept — sub-folders are their
/// own books, exactly as they are on disk — and each is stored under its leaf file name
/// so the page list reads like a folder listing.
///
/// RAR permits duplicate entry names, and lossy filename decoding can also collide;
/// [`load_image`] returns the first match, so only the first occurrence of each leaf
/// name is kept — otherwise the list would show a page twice while both names resolved
/// to the same file, hiding another page.
///
/// # Arguments
///
/// * `filenames` - An iterator of (lossily decoded) entry filenames.
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// The naturally-sorted leaf names, and a map from each leaf name to the archive's own
/// spelling of its full path.
fn collect_entries(
    filenames: impl Iterator<Item = String>,
    inner_dir: &str,
) -> (Vec<String>, HashMap<String, String>) {
    let mut entries: Vec<String> = Vec::new();
    let mut entry_to_path: HashMap<String, String> = HashMap::new();

    for filename in filenames {
        let normalized = archive_path::normalize_entry(&filename);
        if archive_path::is_ignored_entry(&normalized) {
            continue;
        }
        let Some(leaf) = archive_path::leaf_in(&normalized, inner_dir) else {
            continue;
        };
        if !Image::is_supported_format(leaf) || entry_to_path.contains_key(leaf) {
            continue;
        }
        entries.push(leaf.to_string());
        // Keep the archive's own spelling: header names are matched verbatim.
        entry_to_path.insert(leaf.to_string(), filename);
    }

    entries.sort_by(|a, b| natord::compare_ignore_case(a, b));
    (entries, entry_to_path)
}

/// Helper function to open a RAR archive for processing its file data.
fn open(path: &str) -> Result<OpenArchive<Process, CursorBeforeHeader>> {
    Ok(Archive::new(path).open_for_processing()?)
}

#[cfg(test)]
mod tests {
    use std::path;
    use tempfile::tempdir;

    use super::*;
    use crate::image::types::read_dimensions;

    // A valid 1x1 transparent PNG
    const DUMMY_PNG_DATA: &[u8] = &[
        // Header: Magic Number
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // Chunk: IHDR (Image Header)
        0x00, 0x00, 0x00, 0x0D, // Length
        0x49, 0x48, 0x44, 0x52, // Type (IHDR)
        0x00, 0x00, 0x00, 0x01, // Width: 1
        0x00, 0x00, 0x00, 0x01, // Height: 1
        0x08, 0x06, 0x00, 0x00, 0x00, // Bit Depth, Color Type, etc.
        0x1F, 0x15, 0xC4, 0x89, // CRC
        // Chunk: IDAT (Image Data)
        0x00, 0x00, 0x00, 0x0A, // Length
        0x49, 0x44, 0x41, 0x54, // Type (IDAT)
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Raw zlib data
        0x0D, 0x0A, 0x2D, 0xB4, // CRC (Correct for this data)
        // Chunk: IEND (End of Image)
        0x00, 0x00, 0x00, 0x00, // Length
        0x49, 0x45, 0x4E, 0x44, // Type (IEND)
        0xAE, 0x42, 0x60, 0x82, // CRC
    ];

    // Since programmatically generating a RAR file is complicated,
    // a dummy RAR file was created manually beforehand.
    //
    // This function copies that pre-existing RAR file to the path specified in the arguments.
    fn create_dummy_rar(dir: &path::Path, filename: &str) -> path::PathBuf {
        let dummy_rar_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("resources")
            .join("test.rar");
        if !dummy_rar_path.exists() {
            panic!(
                "Dummy RAR file not found at {}. Please create it manually as per instructions.",
                dummy_rar_path.display()
            );
        }

        let rar_filepath = dir.join(filename);
        std::fs::copy(dummy_rar_path, &rar_filepath).expect("failed to copy dummy rar file");
        rar_filepath
    }

    #[test]
    fn test_new_valid_rar() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");

        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        assert_eq!(container.path, rar_path.to_string_lossy().to_string());
        // Expecting 2 entries based on the dummy.rar creation instructions
        assert_eq!(container.entries.len(), 3);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
        assert_eq!(container.entries[2], "image3.png");
    }

    #[test]
    fn collect_entries_deduplicates_and_sorts() {
        // Duplicate names collapse to the first occurrence, unsupported files are
        // dropped, and the result is naturally sorted. Guards against phantom pages
        // from RAR duplicate entries / lossy-decode collisions without needing a
        // duplicate-entry RAR fixture.
        let out = collect_entries(
            vec![
                "b.png".to_string(),
                "a.png".to_string(),
                "b.png".to_string(),     // duplicate → skipped
                "notes.txt".to_string(), // unsupported → skipped
            ]
            .into_iter(),
            "",
        );

        assert_eq!(out.0, vec!["a.png".to_string(), "b.png".to_string()]);
    }

    #[test]
    fn test_new_non_existent_rar() {
        let non_existent_path = String::from("/non/existent/file.rar");
        let container = RarContainer::new(&non_existent_path, "");
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
        assert_eq!(container.entries[2], "image3.png");
    }

    #[test]
    fn rar_reader_reads_stored_bytes_and_measures_them() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        let mut reader = container.open_reader().expect("failed to open a reader");

        assert_eq!(reader.read_page("image1.png").unwrap(), DUMMY_PNG_DATA);
        assert_eq!(
            reader.page_dimensions("image2.png").unwrap(),
            read_dimensions(DUMMY_PNG_DATA).unwrap()
        );
        assert!(reader.read_page("absent.png").is_err());
        assert_eq!(reader.read_preview("image1.png").unwrap(), None);
    }

    #[test]
    fn test_reader_reports_a_missing_entry() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        let result = container.reader().read_page("not_in_the_archive.png");

        assert!(matches!(result, Err(Error::EntryNotFound(_))));
    }

    #[test]
    fn reading_in_order_walks_the_archive_once() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");
        let entries = container.get_entries().clone();

        let mut reader = container.reader();
        for (index, entry) in entries.iter().enumerate() {
            assert_eq!(reader.read_page(entry).unwrap(), DUMMY_PNG_DATA);
            // Each page costs exactly the headers between it and the previous one, so
            // reading the book in order walks the archive once. Reopening per page would
            // make this 1, 3, 6, ... — the quadratic cost that on a solid archive means
            // decompressing every earlier page again.
            assert_eq!(
                reader.walked,
                index + 1,
                "reading {entry} in order must not rewind"
            );
            assert_eq!(reader.position, index + 1);
        }
    }

    #[test]
    fn reading_backwards_reopens_and_still_returns_the_page() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");
        let entries = container.get_entries().clone();

        let mut reader = container.reader();
        assert_eq!(reader.read_page(&entries[2]).unwrap(), DUMMY_PNG_DATA);
        assert_eq!(reader.walked, 3);

        // The cursor cannot go back, so this restarts the walk — the trade the reader
        // makes so a page turn never waits for a scan to finish.
        assert_eq!(reader.read_page(&entries[0]).unwrap(), DUMMY_PNG_DATA);
        assert_eq!(reader.position, 1, "a backward read restarts the walk");
        assert_eq!(reader.walked, 4);

        // And the cursor keeps working forward afterwards, from where it now stands.
        assert_eq!(reader.read_page(&entries[1]).unwrap(), DUMMY_PNG_DATA);
        assert_eq!(reader.position, 2);
        assert_eq!(reader.walked, 5);
    }

    #[test]
    fn a_non_solid_archive_admits_many_readers() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        assert!(!container.is_solid, "the fixture is a normal archive");
        assert_eq!(container.max_readers(), usize::MAX);
    }

    #[test]
    fn a_solid_archive_admits_one_reader() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let mut container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        // No RAR writer exists here, so the flag is set directly: what is under test is
        // the decision it drives, not how `unrar` reports it.
        container.is_solid = true;
        assert_eq!(container.max_readers(), 1);
    }

    #[test]
    fn test_collect_entries_keeps_only_the_opened_folder() {
        let (entries, map) = collect_entries(
            [
                "cover.png".to_string(),
                "ch1/002.png".to_string(),
                "ch1/001.png".to_string(),
                "ch1/deeper/003.png".to_string(),
                "__MACOSX/._001.png".to_string(),
            ]
            .into_iter(),
            "ch1",
        );

        assert_eq!(vec!["001.png".to_string(), "002.png".to_string()], entries);
        // The archive's own spelling is preserved for header matching.
        assert_eq!(Some(&"ch1/001.png".to_string()), map.get("001.png"));
    }

    #[test]
    fn test_collect_entries_at_the_root_excludes_sub_folders() {
        let (entries, _) = collect_entries(
            ["cover.png".to_string(), "ch1/001.png".to_string()].into_iter(),
            "",
        );

        assert_eq!(vec!["cover.png".to_string()], entries);
    }
}
