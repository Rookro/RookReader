use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Seek},
    sync::Arc,
};

use zip::{read::ZipArchiveMetadata, ZipArchive};

use crate::{
    container::{
        archive_path,
        traits::{Container, PageReader},
    },
    error::{Error, Result},
    image::types::{read_dimensions, Image, ImageDimensions},
};

/// Absolute ceiling for a single page's preallocation, and the largest declared
/// uncompressed size [`read_entry_checked`] will attempt to read. An entry declaring
/// more than this is rejected outright instead of being decompressed, so a lying
/// header cannot drive an unbounded read.
const MAX_PREALLOC_BYTES: u64 = 1024 * 1024 * 1024;

/// Bytes of a decompressed entry [`ZipReader::page_dimensions`] reads before giving up
/// and falling back to a full read. A PNG `IHDR` sits in the first 33 bytes and a JPEG
/// `SOF` marker within the first few KiB, so this bound is generous even for a page
/// carrying a large EXIF block — and it turns a 200-page scan from a full inflate of the
/// archive into a header probe.
const HEADER_PROBE_BYTES: u64 = 64 * 1024;

/// Compression ratio we trust when anchoring the preallocation on the compressed
/// size. This path only reads image entries (PNG/JPEG/WebP), which are already
/// compressed and re-deflate at roughly 1:1, so 4x is generous real-world headroom
/// while still tightly bounding a lying header. (DEFLATE's theoretical worst case is
/// ~1032:1, but that does not occur for image data; the 1 GiB absolute cap covers any
/// outlier.)
const MAX_COMPRESSION_RATIO: u64 = 4;

/// Computes a safe preallocation capacity for a ZIP entry.
///
/// The declared uncompressed size comes from the (attacker-controlled) central
/// directory, so a crafted entry can claim a huge size and force an instant
/// `Vec::with_capacity` abort. We anchor instead on the *compressed* size — bounded
/// by bytes that actually exist in the archive — allowing up to `MAX_COMPRESSION_RATIO`
/// times that size, and never reserve more than `MAX_PREALLOC_BYTES`. Legitimate (already
/// poorly-compressible) image pages still preallocate exactly once, avoiding the
/// repeated reallocation a flat cap would cause for large files.
///
/// # Arguments
///
/// * `declared_size` - The entry's declared uncompressed size (`ZipFile::size`).
/// * `compressed_size` - The entry's compressed size (`ZipFile::compressed_size`).
///
/// # Returns
///
/// The number of bytes to pre-reserve: `declared_size`, capped to
/// `MAX_COMPRESSION_RATIO * compressed_size` and to `MAX_PREALLOC_BYTES`.
fn prealloc_capacity(declared_size: u64, compressed_size: u64) -> usize {
    let ceiling = compressed_size
        .saturating_mul(MAX_COMPRESSION_RATIO)
        .min(MAX_PREALLOC_BYTES);
    declared_size.min(ceiling) as usize
}

/// Reads a decompression stream, bounding it to its declared size.
///
/// Preallocation alone (see [`prealloc_capacity`]) caps only the initial reservation;
/// without a read limit a high-ratio DEFLATE bomb would still grow the buffer far past
/// the reserved capacity. Reading at most `declared + 1` bytes makes an over-long stream
/// observable: if the reader yields more than `declared`, the entry is rejected instead
/// of trusting the (attacker-controlled) declared size.
///
/// # Arguments
///
/// * `reader` - The entry's (decompressing) reader.
/// * `declared` - The entry's declared uncompressed size.
/// * `capacity` - Bytes to pre-reserve (from [`prealloc_capacity`]).
/// * `entry` - The entry name, for error messages.
///
/// # Returns
///
/// The entry's bytes, guaranteed to be at most `declared` long.
///
/// # Errors
///
/// Returns an error if the stream produces more than `declared` bytes (possible zip bomb)
/// or if the underlying read fails.
fn read_within_declared<R: Read>(
    reader: R,
    declared: u64,
    capacity: usize,
    entry: &str,
) -> Result<Vec<u8>> {
    let mut buf = Vec::with_capacity(capacity);
    reader.take(declared + 1).read_to_end(&mut buf)?;
    if buf.len() as u64 > declared {
        return Err(crate::error::Error::Other(format!(
            "ZIP entry {entry} exceeds its declared size; possible zip bomb"
        )));
    }
    Ok(buf)
}

/// Reads one archive entry's bytes with the decompressed size bounded.
///
/// Rejects an entry whose declared size exceeds [`MAX_PREALLOC_BYTES`] before reading,
/// then reads through [`read_within_declared`] so a bomb cannot grow the buffer unbounded.
///
/// # Arguments
///
/// * `archive` - The opened ZIP archive.
/// * `index` - The entry's archive index.
/// * `entry` - The entry name, for error messages.
///
/// # Returns
///
/// The entry's decompressed bytes.
///
/// # Errors
///
/// Returns an error if the entry declares more than [`MAX_PREALLOC_BYTES`], exceeds its
/// declared size while reading, or cannot be read.
fn read_entry_checked<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    index: usize,
    entry: &str,
) -> Result<Vec<u8>> {
    let mut file = archive.by_index(index)?;
    let declared = file.size();
    if declared > MAX_PREALLOC_BYTES {
        return Err(crate::error::Error::Other(format!(
            "ZIP entry {entry} declares {declared} bytes, exceeding the {MAX_PREALLOC_BYTES} byte limit"
        )));
    }
    let capacity = prealloc_capacity(declared, file.compressed_size());
    read_within_declared(&mut file, declared, capacity, entry)
}

/// Decodes a raw ZIP entry name as UTF-8, falling back to Shift-JIS for archives
/// produced by legacy Japanese tooling.
///
/// # Arguments
///
/// * `raw_name` - The raw bytes of the entry name from the archive.
///
/// # Returns
///
/// The decoded name.
pub(crate) fn decode_entry_name(raw_name: &[u8]) -> String {
    match std::str::from_utf8(raw_name) {
        Ok(v) => v.to_string(),
        Err(_) => {
            let (decoded, _, _) = encoding_rs::SHIFT_JIS.decode(raw_name);
            decoded.into_owned()
        }
    }
}

/// Builds the naturally-sorted image entry list and the name→archive-index map for one
/// folder inside the archive.
///
/// Each raw name is decoded ([`decode_entry_name`]), normalized, and kept only when it
/// is a supported image sitting *directly* inside `inner_dir` — sub-folders are their
/// own books, exactly as they are on disk. Entries are stored under their leaf file
/// name so the page list reads like a folder listing.
///
/// The first occurrence of a leaf name wins; later duplicates — legal in the ZIP
/// format, or produced by decode collisions (e.g. a UTF-8 name and a Shift-JIS name
/// that decode to the same string) — are skipped so `entries` and `name_to_index`
/// stay consistent. Otherwise the list would show a page twice while both entries
/// resolved to the last index.
///
/// # Arguments
///
/// * `raw_names` - An iterator of `(archive_index, raw_name_bytes)` pairs.
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// The sorted leaf names and a map from each leaf name to its archive index.
fn collect_entries(
    raw_names: impl Iterator<Item = (usize, Vec<u8>)>,
    inner_dir: &str,
) -> (Vec<String>, HashMap<String, usize>) {
    let mut entries: Vec<String> = Vec::new();
    let mut name_to_index: HashMap<String, usize> = HashMap::new();

    for (i, raw_name) in raw_names {
        let normalized = archive_path::normalize_entry(&decode_entry_name(&raw_name));
        if archive_path::is_ignored_entry(&normalized) {
            continue;
        }
        let Some(leaf) = archive_path::leaf_in(&normalized, inner_dir) else {
            continue;
        };
        if !Image::is_supported_format(leaf) || name_to_index.contains_key(leaf) {
            continue;
        }
        entries.push(leaf.to_string());
        name_to_index.insert(leaf.to_string(), i);
    }

    entries.sort_by(|a, b| natord::compare_ignore_case(a, b));
    (entries, name_to_index)
}

/// An implementation of the `Container` trait for reading content from ZIP archive files.
pub struct ZipContainer {
    /// The file path of the ZIP container, reopened once per reader.
    path: String,
    /// A naturally sorted list of the image leaf names in the opened folder.
    entries: Vec<String>,
    /// A mapping from each (possibly garbled) leaf name to its index in the ZIP archive.
    /// Shared with every reader rather than copied into each one.
    name_to_index: Arc<HashMap<String, usize>>,
    /// The parsed central directory, shared with every reader so opening one costs a
    /// `File::open` rather than a re-parse of the whole directory.
    metadata: Arc<ZipArchiveMetadata>,
}

impl Container for ZipContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn is_directory(&self) -> bool {
        false
    }

    fn open_reader(&self) -> Result<Box<dyn PageReader>> {
        let file = File::open(&self.path)?;
        // SAFETY: `metadata` was parsed in `ZipContainer::new` from this exact path, and
        // the file is opened read-only, so the fresh handle and the shared central
        // directory describe the same archive.
        let archive = unsafe { ZipArchive::unsafe_new_with_metadata(file, self.metadata.clone()) };
        Ok(Box::new(ZipReader {
            archive,
            name_to_index: self.name_to_index.clone(),
        }))
    }
}

/// A single thread's handle on one ZIP archive.
///
/// Each reader owns its own `File`, so nothing here is shared and no lock is taken: the
/// only state the readers have in common is the immutable central directory.
struct ZipReader {
    archive: ZipArchive<File>,
    name_to_index: Arc<HashMap<String, usize>>,
}

impl ZipReader {
    /// Maps a leaf entry name to its index in the archive.
    fn index_of(&self, entry: &str) -> Result<usize> {
        self.name_to_index
            .get(entry)
            .copied()
            .ok_or_else(|| Error::EntryNotFound(format!("Entry not found in ZIP: {entry}")))
    }
}

impl PageReader for ZipReader {
    fn read_page(&mut self, entry: &str) -> Result<Vec<u8>> {
        let index = self.index_of(entry)?;
        read_entry_checked(&mut self.archive, index, entry)
    }

    fn page_dimensions(&mut self, entry: &str) -> Result<ImageDimensions> {
        let index = self.index_of(entry)?;
        let file = self.archive.by_index(index)?;
        // A hard ceiling bounds this read the way `prealloc_capacity` and
        // `read_within_declared` bound a full one, so a lying central directory cannot
        // drive it any further than 64 KiB. The fallback below goes through `read_page`,
        // which still applies both.
        let want = file.size().min(HEADER_PROBE_BYTES);
        let mut head = Vec::with_capacity(want as usize);
        file.take(want).read_to_end(&mut head)?;

        match read_dimensions(&head) {
            Ok(dimensions) => Ok(dimensions),
            // A header longer than the probe is rare but legal; pay for the full read.
            Err(_) => Ok(read_dimensions(&self.read_page(entry)?)?),
        }
    }
}

impl ZipContainer {
    /// Creates a new `ZipContainer` from the ZIP file at the specified path.
    ///
    /// This constructor opens the ZIP archive, filters for supported image formats,
    /// and sorts the resulting file list in natural order.
    ///
    /// # Arguments
    ///
    /// * `path` - The path to the ZIP file.
    /// * `inner_dir` - The folder inside the archive to open as the book, `/`-separated.
    ///   Empty opens the archive root, whose pages are the images directly at the root.
    ///
    /// # Returns
    ///
    /// A `Result` containing a new `ZipContainer` instance on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the ZIP file cannot be opened or read.
    pub fn new(path: &str, inner_dir: &str) -> Result<Self> {
        let file = File::open(path)?;
        let mut archive = ZipArchive::new(file)?;

        let len = archive.len();
        let mut raw_names: Vec<(usize, Vec<u8>)> = Vec::with_capacity(len);
        for i in 0..len {
            let file = archive.by_index(i)?;
            raw_names.push((i, file.name_raw().to_vec()));
        }

        let (entries, name_to_index) = collect_entries(raw_names.into_iter(), inner_dir);
        // The archive opened for listing is dropped with this function: its central
        // directory is all that is kept, and every reader opens its own handle over it.
        let metadata = archive.metadata();

        Ok(Self {
            path: path.to_string(),
            entries,
            name_to_index: Arc::new(name_to_index),
            metadata,
        })
    }
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Write, path};
    use tempfile::tempdir;
    use zip::write::{FileOptions, ZipWriter};

    use super::*;

    // Helper function to create a dummy ZIP file with specified image entries.
    fn create_dummy_zip(
        dir: &path::Path,
        filename: &str,
        entries: &[(&str, &[u8])],
    ) -> path::PathBuf {
        let zip_filepath = dir.join(filename);
        let file = File::create(&zip_filepath).expect("failed to create zip file");
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::<()>::default()
            .compression_method(zip::CompressionMethod::DEFLATE)
            .unix_permissions(0o755);

        for (entry_name, content) in entries {
            zip.start_file(entry_name, options)
                .expect("failed to start zip entry");
            zip.write_all(content)
                .expect("failed to write zip entry content");
        }
        zip.finish().expect("failed to finish zip file");
        zip_filepath
    }

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

    #[test]
    fn test_new_valid_zip() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[
                ("image1.png", DUMMY_PNG_DATA),
                ("image2.png", DUMMY_PNG_DATA),
                ("text.txt", b"hello"),
            ],
        );

        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str(), "")
            .expect("failed to create ZipContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
    }

    /// Builds a JPEG whose `SOF` marker — the segment carrying the dimensions — sits
    /// beyond [`HEADER_PROBE_BYTES`], by padding the header with `APP9` segments no
    /// decoder assigns a meaning to and every decoder skips by length.
    fn jpeg_with_oversized_header(width: u32, height: u32) -> Vec<u8> {
        let mut jpeg = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 80)
            .encode_image(&image::DynamicImage::ImageRgb8(image::RgbImage::new(
                width, height,
            )))
            .expect("failed to encode jpeg");

        let mut out = vec![0xFF, 0xD8]; // SOI
        while (out.len() as u64) <= HEADER_PROBE_BYTES {
            out.extend_from_slice(&[0xFF, 0xE9]); // APP9
            out.extend_from_slice(&u16::MAX.to_be_bytes()); // length, including itself
            out.extend(std::iter::repeat_n(0u8, u16::MAX as usize - 2));
        }
        out.extend_from_slice(&jpeg[2..]);
        out
    }

    #[test]
    fn zip_reader_reads_stored_bytes_and_measures_them() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[("image1.png", DUMMY_PNG_DATA), ("image2.png", DUMMY_PNG_DATA)],
        );
        let container = ZipContainer::new(zip_path.to_string_lossy().as_ref(), "")
            .expect("failed to create ZipContainer");

        let mut reader = container.open_reader().expect("failed to open a reader");

        // The bytes come back exactly as stored: a reader decodes nothing.
        assert_eq!(reader.read_page("image1.png").unwrap(), DUMMY_PNG_DATA);
        assert_eq!(
            reader.page_dimensions("image2.png").unwrap(),
            read_dimensions(DUMMY_PNG_DATA).unwrap()
        );
        assert!(reader.read_page("absent.png").is_err());
        // No format but PDF can preview a page more cheaply than it can read it.
        assert_eq!(reader.read_preview("image1.png").unwrap(), None);
    }

    #[test]
    fn zip_reader_measures_a_header_beyond_the_probe() {
        let jpeg = jpeg_with_oversized_header(7, 3);
        assert!(
            read_dimensions(&jpeg[..HEADER_PROBE_BYTES as usize]).is_err(),
            "the fixture must defeat the probe, or this test proves nothing"
        );

        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(dir.path(), "wide.zip", &[("wide.jpg", &jpeg)]);
        let container = ZipContainer::new(zip_path.to_string_lossy().as_ref(), "")
            .expect("failed to create ZipContainer");

        let mut reader = container.open_reader().expect("failed to open a reader");

        // The probe comes up empty, so the reader pays for the full read rather than
        // reporting the page unreadable.
        assert_eq!(
            reader.page_dimensions("wide.jpg").unwrap(),
            ImageDimensions {
                width: 7,
                height: 3
            }
        );
    }

    #[test]
    fn zip_readers_are_independent() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[("image1.png", DUMMY_PNG_DATA), ("image2.png", DUMMY_PNG_DATA)],
        );
        let container = ZipContainer::new(zip_path.to_string_lossy().as_ref(), "")
            .expect("failed to create ZipContainer");

        // Two readers over one archive, interleaved: each owns its own file handle, so
        // neither disturbs the other's position.
        let mut first = container.open_reader().expect("failed to open the first reader");
        let mut second = container
            .open_reader()
            .expect("failed to open the second reader");

        assert_eq!(first.read_page("image2.png").unwrap(), DUMMY_PNG_DATA);
        assert_eq!(second.read_page("image1.png").unwrap(), DUMMY_PNG_DATA);
        assert_eq!(first.read_page("image1.png").unwrap(), DUMMY_PNG_DATA);
    }

    #[test]
    fn test_collect_entries_deduplicates_identical_names() {
        // Two archive members with identical raw names (legal in the ZIP format, even
        // though our writer forbids it) must collapse to a single entry; the first wins.
        let (entries, name_to_index) = collect_entries(
            vec![(0usize, b"a.png".to_vec()), (1usize, b"a.png".to_vec())].into_iter(),
            "",
        );

        assert_eq!(entries, vec!["a.png".to_string()]);
        assert_eq!(name_to_index.get("a.png"), Some(&0));
    }

    #[test]
    fn test_collect_entries_deduplicates_decoded_collisions() {
        // Two DIFFERENT raw byte names that decode to the SAME string: one UTF-8, one
        // Shift-JIS. The dedup must keep only the first occurrence.
        let utf8_name = "ファイル.png".as_bytes().to_vec();
        let (sjis_cow, _, _) = encoding_rs::SHIFT_JIS.encode("ファイル.png");
        let sjis_name = sjis_cow.into_owned();
        assert_ne!(utf8_name, sjis_name, "raw bytes must genuinely differ");

        let (entries, name_to_index) = collect_entries(
            vec![(0usize, utf8_name), (1usize, sjis_name)].into_iter(),
            "",
        );

        assert_eq!(entries, vec!["ファイル.png".to_string()]);
        // First occurrence (archive index 0) wins.
        assert_eq!(name_to_index.get("ファイル.png"), Some(&0));
    }

    #[test]
    fn test_new_empty_zip() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(dir.path(), "empty.zip", &[]);

        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str(), "")
            .expect("failed to create ZipContainer");
        assert!(container.entries.is_empty());
    }

    #[test]
    fn test_new_non_existent_zip() {
        let non_existent_path = String::from("/non/existent/file.zip");
        let container = ZipContainer::new(&non_existent_path, "");
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[
                ("image_c.png", DUMMY_PNG_DATA),
                ("image_a.png", DUMMY_PNG_DATA),
                ("image_b.png", DUMMY_PNG_DATA),
            ],
        );

        let container =
            ZipContainer::new(zip_path.to_string_lossy().to_string().as_str(), "").unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], "image_a.png");
        assert_eq!(entries[1], "image_b.png");
        assert_eq!(entries[2], "image_c.png");
    }

    #[test]
    fn test_get_image_capacity_cap_does_not_truncate() {
        // The preallocation is bounded; reading a normal entry must still return its
        // exact bytes (guards against an off-by-one in the capacity computation).
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", DUMMY_PNG_DATA)]);
        let container =
            ZipContainer::new(zip_path.to_string_lossy().to_string().as_str(), "").unwrap();

        let page = container
            .open_reader()
            .unwrap()
            .read_page("image1.png")
            .expect("reading an existing entry should succeed");
        assert_eq!(page, DUMMY_PNG_DATA);
    }

    #[test]
    fn test_prealloc_capacity() {
        // A legitimate, poorly-compressible page (declared ~= compressed) preallocates
        // the full declared size in one shot.
        assert_eq!(
            prealloc_capacity(10 * 1024 * 1024, 10 * 1024 * 1024),
            10 * 1024 * 1024
        );

        // A lying header (tiny compressed, huge declared) is clamped to the
        // compressed-size-derived ceiling, not the declared size.
        assert_eq!(
            prealloc_capacity(10 * 1024 * 1024 * 1024, 1024),
            (1024 * MAX_COMPRESSION_RATIO) as usize
        );

        // The absolute ceiling bounds even a large compressed entry.
        assert_eq!(
            prealloc_capacity(u64::MAX, u64::MAX),
            MAX_PREALLOC_BYTES as usize
        );
    }

    #[test]
    fn read_within_declared_accepts_exact_size() {
        // A well-formed entry (actual == declared) reads back its exact bytes with no
        // false-positive bomb rejection.
        let data = vec![1u8, 2, 3, 4, 5];
        let out =
            read_within_declared(data.as_slice(), data.len() as u64, data.len(), "ok.png").unwrap();
        assert_eq!(out, data);
    }

    #[test]
    fn read_within_declared_rejects_oversized_stream() {
        // The stream yields far more than the declared size: a bomb. The read is bounded
        // to declared + 1 and the entry is rejected instead of growing unbounded.
        let data = vec![0u8; 100];
        let err = read_within_declared(data.as_slice(), 10, 10, "bomb.png").unwrap_err();
        assert!(
            err.to_string().contains("possible zip bomb"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn read_entry_checked_reads_valid_entry() {
        // End-to-end through the checked path on an in-memory archive: a valid entry
        // round-trips unchanged.
        let mut bytes = Vec::new();
        {
            let mut zip = ZipWriter::new(std::io::Cursor::new(&mut bytes));
            let options =
                FileOptions::<()>::default().compression_method(zip::CompressionMethod::DEFLATE);
            zip.start_file("image1.png", options).unwrap();
            zip.write_all(DUMMY_PNG_DATA).unwrap();
            zip.finish().unwrap();
        }
        let mut archive = ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();

        let out = read_entry_checked(&mut archive, 0, "image1.png").unwrap();
        assert_eq!(out, DUMMY_PNG_DATA);
    }

    #[test]
    fn test_root_book_excludes_images_in_sub_folders() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "nested.zip",
            &[
                ("cover.png", DUMMY_PNG_DATA),
                ("ch1/001.png", DUMMY_PNG_DATA),
                ("ch1/002.png", DUMMY_PNG_DATA),
            ],
        );

        let container =
            ZipContainer::new(zip_path.to_string_lossy().as_ref(), "").expect("open root");

        assert_eq!(vec!["cover.png".to_string()], *container.get_entries());
    }

    #[test]
    fn test_inner_folder_is_its_own_book_with_leaf_names() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "nested.zip",
            &[
                ("cover.png", DUMMY_PNG_DATA),
                ("ch1/002.png", DUMMY_PNG_DATA),
                ("ch1/001.png", DUMMY_PNG_DATA),
                ("ch1/deeper/003.png", DUMMY_PNG_DATA),
            ],
        );

        let container =
            ZipContainer::new(zip_path.to_string_lossy().as_ref(), "ch1").expect("open ch1");

        // Leaf names only, naturally sorted, and `deeper/` is a separate book.
        assert_eq!(
            vec!["001.png".to_string(), "002.png".to_string()],
            *container.get_entries()
        );
        assert!(container.open_reader().unwrap().read_page("001.png").is_ok());
    }

    #[test]
    fn test_macos_metadata_entries_are_skipped() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "macos.zip",
            &[
                ("001.png", DUMMY_PNG_DATA),
                ("__MACOSX/._001.png", DUMMY_PNG_DATA),
            ],
        );

        let container =
            ZipContainer::new(zip_path.to_string_lossy().as_ref(), "").expect("open root");

        assert_eq!(vec!["001.png".to_string()], *container.get_entries());
    }
}
