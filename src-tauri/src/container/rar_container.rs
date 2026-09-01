//! RAR container implementation.
//!
//! # Performance Constraints
//!
//! The underlying `unrar` library's `OpenArchive` type does not implement `Send`.
//! This prevents sharing a single opened archive instance across multiple threads (e.g., inside a Mutex).
//! Consequently, the archive has to be opened and scanned sequentially for every image request.

use unrar::{Archive, CursorBeforeHeader, OpenArchive, Process};

use std::{collections::HashMap, sync::Arc};

use crate::{
    container::{
        archive_path,
        traits::{Container, PageReader},
    },
    error::{Error, Result},
    image::{
        thumbnail::generate_thumbnail,
        types::{read_dimensions, Image, ImageDimensions},
    },
};

/// An implementation of the `Container` trait for reading content from RAR archive files.
///
/// NOTE: The underlying `unrar` library's `OpenArchive` type does not implement `Send`,
/// which prevents us from sharing a single opened archive instance across threads using a Mutex.
/// As a result, this implementation currently opens the archive for each image request.
pub struct RarContainer {
    /// The file path of the RAR container.
    path: String,
    /// A naturally sorted list of the image leaf names in the opened folder.
    entries: Vec<String>,
    /// Maps each leaf name back to its full path inside the archive, which is what the
    /// archive headers carry. Shared with every reader rather than copied into each one.
    entry_to_path: Arc<HashMap<String, String>>,
}

impl Container for RarContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &str) -> Result<Arc<Image>> {
        load_image(&self.path, self.resolve_entry(entry)?)
    }

    fn get_thumbnail(&self, entry: &str) -> Result<Arc<Image>> {
        create_thumbnail(&self.path, self.resolve_entry(entry)?)
    }

    fn get_image_dimensions(&self) -> Result<Vec<ImageDimensions>> {
        let paths = self
            .entries
            .iter()
            .map(|entry| self.resolve_entry(entry).map(str::to_string))
            .collect::<Result<Vec<String>>>()?;
        read_all_dimensions(&self.path, &paths)
    }

    fn is_directory(&self) -> bool {
        false
    }

    fn max_readers(&self) -> usize {
        1
    }

    fn open_reader(&self) -> Result<Box<dyn PageReader>> {
        Ok(Box::new(RarReader {
            path: self.path.clone(),
            entry_to_path: self.entry_to_path.clone(),
        }))
    }
}

/// A reader over one RAR archive.
///
/// It reopens the archive for every page, which is what the container has always done —
/// `unrar`'s `OpenArchive` is not `Send`, so there was nowhere to keep one. Owning the
/// reader for the life of a book is what makes a persistent cursor possible; that lands
/// separately, and until it does the cost is unchanged.
struct RarReader {
    path: String,
    entry_to_path: Arc<HashMap<String, String>>,
}

impl PageReader for RarReader {
    fn read_page(&mut self, entry: &str) -> Result<Vec<u8>> {
        let target = self
            .entry_to_path
            .get(entry)
            .ok_or_else(|| Error::EntryNotFound(format!("Entry not found in RAR: {entry}")))?;

        let mut archive = open(&self.path)?;
        while let Some(header) = archive.read_header()? {
            let filename = header.entry().filename.to_string_lossy().to_string();
            if filename == *target {
                let (data, rest) = header.read()?;
                drop(rest); // close the archive
                return Ok(data);
            }
            archive = header.skip()?;
        }

        Err(Error::EntryNotFound(format!("Entry not found: {target}")))
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

        let mut filenames: Vec<String> = Vec::new();
        for entry_result in archive {
            let entry = entry_result?;
            if entry.is_file() {
                filenames.push(entry.filename.to_string_lossy().to_string());
            }
        }

        let (entries, entry_to_path) = collect_entries(filenames.into_iter(), inner_dir);

        Ok(Self {
            path: path.to_string(),
            entries,
            entry_to_path: Arc::new(entry_to_path),
        })
    }

    /// Maps a leaf entry name to its full path inside the archive.
    ///
    /// # Arguments
    ///
    /// * `entry` - The leaf name as it appears in [`Container::get_entries`].
    ///
    /// # Returns
    ///
    /// The entry's full path inside the archive, as the archive headers spell it.
    ///
    /// # Errors
    ///
    /// Returns [`Error::EntryNotFound`] when the name is not part of this book.
    fn resolve_entry(&self, entry: &str) -> Result<&str> {
        self.entry_to_path
            .get(entry)
            .map(String::as_str)
            .ok_or_else(|| Error::EntryNotFound(format!("Entry not found in RAR: {entry}")))
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

/// Helper function to find and extract a specific file from a RAR archive.
///
/// # Performance
///
/// Because the underlying `unrar` crate does not support parallel random-access reading,
/// we must re-open the archive and perform a sequential scan of entries until the target `entry` is found.
/// This results in $O(N)$ operations where $N$ is the entry index.
///
/// TODO: In the future, we could consider an in-memory extraction cache or a dedicated background actor
/// that keeps the archive open and processes requests sequentially on a single thread.
fn load_image(path: &str, entry: &str) -> Result<Arc<Image>> {
    let mut archive = open(path)?;
    while let Some(header) = archive.read_header()? {
        let filename = header.entry().filename.to_string_lossy().to_string();
        if filename == *entry {
            let (data, rest) = header.read()?;
            drop(rest); // close the archive
            let img = Image::new(data)?;
            return Ok(Arc::new(img));
        } else {
            archive = header.skip()?;
        }
    }

    Err(Error::EntryNotFound(format!("Entry not found: {}", entry)))
}

/// Reads every entry's dimensions in a single pass over the archive.
///
/// [`load_image`] rescans from the start for each entry, so calling it per entry would
/// be $O(N^2)$; this walks the archive once and extracts only the wanted entries.
///
/// # Arguments
///
/// * `path` - The path to the RAR file.
/// * `entries` - The entry names to measure, in the order the result must follow.
///
/// # Returns
///
/// One `ImageDimensions` per name in `entries`.
///
/// # Errors
///
/// Returns an `Err` if the archive cannot be walked, an entry is missing from it, or an
/// entry is not a supported image.
fn read_all_dimensions(path: &str, entries: &[String]) -> Result<Vec<ImageDimensions>> {
    let wanted: std::collections::HashSet<&str> = entries.iter().map(String::as_str).collect();
    let mut found: std::collections::HashMap<String, ImageDimensions> =
        std::collections::HashMap::new();

    let mut archive = open(path)?;
    while let Some(header) = archive.read_header()? {
        let filename = header.entry().filename.to_string_lossy().to_string();
        // Duplicate names are possible; load_image returns the first match, so keep it.
        if wanted.contains(filename.as_str()) && !found.contains_key(&filename) {
            let (data, rest) = header.read()?;
            found.insert(filename, read_dimensions(&data)?);
            archive = rest;
        } else {
            archive = header.skip()?;
        }
    }

    entries
        .iter()
        .map(|entry| {
            found
                .get(entry)
                .copied()
                .ok_or_else(|| Error::EntryNotFound(format!("Entry not found: {}", entry)))
        })
        .collect()
}

/// Helper function to load an image and generate a JPEG thumbnail for it.
fn create_thumbnail(path: &str, entry: &str) -> Result<Arc<Image>> {
    let img = load_image(path, entry)?;
    generate_thumbnail(&img.data)
}

#[cfg(test)]
mod tests {
    use std::path;
    use tempfile::tempdir;

    use super::*;

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
    fn test_get_image_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        // Assuming 'image1.png' exists in dummy.rar and is a valid image
        let image = container
            .get_image("image1.png")
            .expect("get_image should succeed for existing image");
        assert!(image.width > 0);
        assert!(image.height > 0);
        assert!(!image.data.is_empty());
        assert_eq!(image.data, DUMMY_PNG_DATA);
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
    fn test_get_image_non_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");
        let result = container.get_image("non_existent_image.png");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_image_dimensions_covers_every_entry_in_one_pass() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        let dimensions = container
            .get_image_dimensions()
            .expect("get_image_dimensions should succeed");

        assert_eq!(dimensions.len(), container.get_entries().len());
        assert!(dimensions.iter().all(|d| *d
            == ImageDimensions {
                width: 1,
                height: 1
            }));
    }

    #[test]
    fn test_get_image_dimensions_reports_a_missing_entry() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let entries = vec!["not_in_the_archive.png".to_string()];

        let result = read_all_dimensions(rar_path.to_string_lossy().as_ref(), &entries);

        assert!(matches!(result, Err(Error::EntryNotFound(_))));
    }

    #[test]
    fn test_get_thumbnail() {
        let dir = tempdir().expect("failed to create tempdir");
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(rar_path.to_string_lossy().as_ref(), "")
            .expect("failed to create RarContainer");

        let thumbnail = container.get_thumbnail("image1.png").unwrap();
        assert!(thumbnail.width <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(thumbnail.height <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(!thumbnail.data.is_empty());
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
