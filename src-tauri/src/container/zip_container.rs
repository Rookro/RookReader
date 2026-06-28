use std::{collections::HashMap, fs::File, io::Read, sync::Arc, sync::Mutex};

use zip::ZipArchive;

use crate::{
    container::traits::Container,
    error::Result,
    image::{thumbnail::generate_thumbnail, types::Image},
};

/// Absolute ceiling for a single page's preallocation, regardless of other signals.
const MAX_PREALLOC_BYTES: u64 = 1024 * 1024 * 1024;

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
fn decode_entry_name(raw_name: &[u8]) -> String {
    match std::str::from_utf8(raw_name) {
        Ok(v) => v.to_string(),
        Err(_) => {
            let (decoded, _, _) = encoding_rs::SHIFT_JIS.decode(raw_name);
            decoded.into_owned()
        }
    }
}

/// Builds the naturally-sorted image entry list and the name→archive-index map.
///
/// Each raw name is decoded ([`decode_entry_name`]) and filtered to supported image
/// formats. The first occurrence of a decoded name wins; later duplicates — legal in
/// the ZIP format, or produced by decode collisions (e.g. a UTF-8 name and a Shift-JIS
/// name that decode to the same string) — are skipped so `entries` and `name_to_index`
/// stay consistent. Otherwise the list would show a page twice while both entries
/// resolved to the last index.
///
/// # Arguments
///
/// * `raw_names` - An iterator of `(archive_index, raw_name_bytes)` pairs.
///
/// # Returns
///
/// The sorted entry names and a map from each name to its archive index.
fn collect_entries(
    raw_names: impl Iterator<Item = (usize, Vec<u8>)>,
) -> (Vec<String>, HashMap<String, usize>) {
    let mut entries: Vec<String> = Vec::new();
    let mut name_to_index: HashMap<String, usize> = HashMap::new();

    for (i, raw_name) in raw_names {
        let name = decode_entry_name(&raw_name);
        if Image::is_supported_format(&name) {
            if name_to_index.contains_key(&name) {
                continue;
            }
            entries.push(name.clone());
            name_to_index.insert(name, i);
        }
    }

    entries.sort_by(|a, b| natord::compare_ignore_case(a, b));
    (entries, name_to_index)
}

/// An implementation of the `Container` trait for reading content from ZIP archive files.
pub struct ZipContainer {
    /// A naturally sorted list of image file names found within the archive.
    entries: Vec<String>,
    /// A mapping from (possibly garbled) entry names to their indices in the ZIP archive.
    name_to_index: HashMap<String, usize>,
    /// The ZIP archive, protected by a Mutex for thread-safe access to the underlying file.
    archive: Mutex<ZipArchive<File>>,
}

impl Container for ZipContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &str) -> Result<Arc<Image>> {
        let buffer = {
            let mut archive = self.archive.lock().map_err(|e| {
                crate::error::Error::Other(format!("Failed to lock zip archive: {}", e))
            })?;
            let index = self.name_to_index.get(entry).ok_or_else(|| {
                crate::error::Error::Other(format!("Entry not found in ZIP: {}", entry))
            })?;
            let mut file = archive.by_index(*index)?;
            let capacity = prealloc_capacity(file.size(), file.compressed_size());
            let mut buf = Vec::with_capacity(capacity);
            file.read_to_end(&mut buf)?;
            buf
        };

        let image = Image::new(buffer)?;
        Ok(Arc::new(image))
    }

    fn get_thumbnail(&self, entry: &str) -> Result<Arc<Image>> {
        let buffer = {
            let mut archive = self.archive.lock().map_err(|e| {
                crate::error::Error::Other(format!("Failed to lock zip archive: {}", e))
            })?;
            let index = self.name_to_index.get(entry).ok_or_else(|| {
                crate::error::Error::Other(format!("Entry not found in ZIP: {}", entry))
            })?;
            let mut file = archive.by_index(*index)?;
            let capacity = prealloc_capacity(file.size(), file.compressed_size());
            let mut buf = Vec::with_capacity(capacity);
            file.read_to_end(&mut buf)?;
            buf
        };

        generate_thumbnail(&buffer)
    }

    fn is_directory(&self) -> bool {
        false
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
    ///
    /// # Returns
    ///
    /// A `Result` containing a new `ZipContainer` instance on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the ZIP file cannot be opened or read.
    pub fn new(path: &str) -> Result<Self> {
        let file = File::open(path)?;
        let mut archive = ZipArchive::new(file)?;

        let len = archive.len();
        let mut raw_names: Vec<(usize, Vec<u8>)> = Vec::with_capacity(len);
        for i in 0..len {
            let file = archive.by_index(i)?;
            raw_names.push((i, file.name_raw().to_vec()));
        }

        let (entries, name_to_index) = collect_entries(raw_names.into_iter());

        Ok(Self {
            entries,
            name_to_index,
            archive: Mutex::new(archive),
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

        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str())
            .expect("failed to create ZipContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
    }

    #[test]
    fn test_collect_entries_deduplicates_identical_names() {
        // Two archive members with identical raw names (legal in the ZIP format, even
        // though our writer forbids it) must collapse to a single entry; the first wins.
        let (entries, name_to_index) = collect_entries(
            vec![(0usize, b"a.png".to_vec()), (1usize, b"a.png".to_vec())].into_iter(),
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

        let (entries, name_to_index) =
            collect_entries(vec![(0usize, utf8_name), (1usize, sjis_name)].into_iter());

        assert_eq!(entries, vec!["ファイル.png".to_string()]);
        // First occurrence (archive index 0) wins.
        assert_eq!(name_to_index.get("ファイル.png"), Some(&0));
    }

    #[test]
    fn test_new_empty_zip() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(dir.path(), "empty.zip", &[]);

        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str())
            .expect("failed to create ZipContainer");
        assert!(container.entries.is_empty());
    }

    #[test]
    fn test_new_non_existent_zip() {
        let non_existent_path = String::from("/non/existent/file.zip");
        let container = ZipContainer::new(&non_existent_path);
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

        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str()).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], "image_a.png");
        assert_eq!(entries[1], "image_b.png");
        assert_eq!(entries[2], "image_c.png");
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", DUMMY_PNG_DATA)]);
        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str())
            .expect("failed to create ZipContainer");

        let image = container
            .get_image("image1.png")
            .expect("get_image should succeed for existing image");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, DUMMY_PNG_DATA);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", DUMMY_PNG_DATA)]);
        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str()).unwrap();
        let result = container.get_image("non_existent_image.png");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_image_capacity_cap_does_not_truncate() {
        // The preallocation is bounded; reading a normal entry must still return its
        // exact bytes (guards against an off-by-one in the capacity computation).
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", DUMMY_PNG_DATA)]);
        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str()).unwrap();

        let image = container
            .get_image("image1.png")
            .expect("get_image should succeed for existing image");
        assert_eq!(image.data, DUMMY_PNG_DATA);
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
    fn test_get_thumbnail() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", DUMMY_PNG_DATA)]);
        let container = ZipContainer::new(zip_path.to_string_lossy().to_string().as_str()).unwrap();

        let thumbnail = container.get_thumbnail("image1.png").unwrap();
        assert!(thumbnail.width <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(thumbnail.height <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(!thumbnail.data.is_empty());
    }
}
