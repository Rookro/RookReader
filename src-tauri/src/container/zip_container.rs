use std::{
    fs::File,
    io::{Cursor, Read},
    sync::Arc,
};

use image::{codecs::jpeg::JpegEncoder, ImageReader};
use zip::ZipArchive;

use crate::{
    container::{container::Container, image::Image},
    error::Result,
};

/// An implementation of the `Container` trait for reading content from ZIP archive files.
pub struct ZipContainer {
    /// The file path of the ZIP container.
    path: String,
    /// A naturally sorted list of image file names found within the archive.
    entries: Vec<String>,
}

impl Container for ZipContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &String) -> Result<Arc<Image>> {
        let mut buffer = Vec::new();
        let file = File::open(&self.path)?;
        let mut archive = ZipArchive::new(file)?;
        let mut file = archive.by_name(entry)?;
        file.read_to_end(&mut buffer)?;

        let image = Image::new(buffer)?;
        Ok(Arc::new(image))
    }

    fn get_thumbnail(&self, entry: &String) -> Result<Arc<Image>> {
        let mut buffer = Vec::new();
        let file = File::open(&self.path)?;
        let mut archive = ZipArchive::new(file)?;
        let mut file = archive.by_name(entry)?;
        file.read_to_end(&mut buffer)?;

        let cursor = Cursor::new(&buffer);
        let image_reader = ImageReader::new(cursor).with_guessed_format()?;
        let image = image_reader.decode()?;

        let thumbnail = image.thumbnail(
            <dyn Container>::THUMBNAIL_SIZE,
            <dyn Container>::THUMBNAIL_SIZE,
        );

        let mut buffer = Vec::new();
        // Use a lower quality for thumbnails to make them smaller and faster to encode.
        let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 10);
        encoder.encode_image(&thumbnail)?;

        Ok(Arc::new(Image {
            data: buffer,
            width: thumbnail.width(),
            height: thumbnail.height(),
        }))
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
    pub fn new(path: &String) -> Result<Self> {
        let file = File::open(&path)?;
        let archive = ZipArchive::new(file)?;

        let mut entries: Vec<String> = archive
            .file_names()
            .filter(|name| Image::is_supported_format(name))
            .map(|s| s.to_string())
            .collect();

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            path: path.clone(),
            entries,
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
                ("image1.png", &DUMMY_PNG_DATA),
                ("image2.png", &DUMMY_PNG_DATA),
                ("text.txt", b"hello"),
            ],
        );

        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
            .expect("failed to create ZipContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
    }

    #[test]
    fn test_new_empty_zip() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(dir.path(), "empty.zip", &[]);

        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
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
                ("image_c.png", &DUMMY_PNG_DATA),
                ("image_a.png", &DUMMY_PNG_DATA),
                ("image_b.png", &DUMMY_PNG_DATA),
            ],
        );

        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string()).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], "image_a.png");
        assert_eq!(entries[1], "image_b.png");
        assert_eq!(entries[2], "image_c.png");
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
            .expect("failed to create ZipContainer");

        let image = container
            .get_image(&String::from("image1.png"))
            .expect("get_image should succeed for existing image");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, DUMMY_PNG_DATA);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string()).unwrap();
        let result = container.get_image(&String::from("non_existent_image.png"));
        assert!(result.is_err());
    }
}
