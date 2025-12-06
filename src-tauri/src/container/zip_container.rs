use std::{collections::HashMap, fs::File, io::Read, sync::Arc};

use zip::ZipArchive;

use crate::container::{
    container::{Container, ContainerError},
    image::Image,
};

/// A container for Zip archives.
pub struct ZipContainer {
    /// The file path of the container.
    path: String,
    /// The Zip archive.
    archive: ZipArchive<File>,
    /// The entries in the container.
    entries: Vec<String>,
    /// Image data cache (key: entry name, value: image).
    cache: HashMap<String, Arc<Image>>,
}

impl Container for ZipContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            return Ok(Arc::clone(&image_arc));
        }

        let mut file_in_zip = self.archive.by_name(entry).map_err(|e| ContainerError {
            message: String::from(format!("Failed to get entry. {}", e)),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;
        let mut buffer = Vec::new();
        file_in_zip
            .read_to_end(&mut buffer)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to read entry in the zip archive. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        match Image::new(buffer) {
            Ok(image) => {
                let image_arc = Arc::new(image);
                self.cache.insert(entry.clone(), Arc::clone(&image_arc));
                Ok(image_arc)
            }
            Err(e) => {
                log::error!("{}", e);
                Err(ContainerError {
                    message: e,
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })
            }
        }
    }

    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        for i in begin_index..end {
            // If it's already in the cache, skip it.
            let entry = &self.entries[i];
            if self.cache.contains_key(entry) {
                log::debug!("Hit cache so skip preload index: {}", i);
                continue;
            }

            let mut buffer = Vec::new();
            {
                let mut file = self.archive.by_name(entry).map_err(|e| ContainerError {
                    message: format!("Failed to get the file. {}", e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;

                file.read_to_end(&mut buffer).map_err(|e| ContainerError {
                    message: String::from(format!(
                        "Failed to read entry in the zip archive. {}",
                        e
                    )),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            };

            match Image::new(buffer) {
                Ok(image) => {
                    self.cache.insert(entry.clone(), Arc::new(image));
                }
                Err(e) => {
                    log::error!("{}", e);
                    return Err(ContainerError {
                        message: e,
                        path: Some(self.path.clone()),
                        entry: Some(entry.clone()),
                    });
                }
            }
        }
        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError> {
        Ok(self.cache.get(entry).map(|arc| Arc::clone(arc)))
    }
}

impl ZipContainer {
    /// Creates a ZIP archive container from the specified path.
    ///
    /// * `path` - The path to the archive container.
    pub fn new(path: &String) -> Result<Self, ContainerError> {
        let file = File::open(path).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the file. {}", e)),
            path: Some(path.clone()),
            entry: None,
        })?;
        let archive = ZipArchive::new(file).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the zip archive. {}", e)),
            path: Some(path.clone()),
            entry: None,
        })?;

        let mut entries: Vec<String> = archive
            .file_names()
            .filter(|name| Image::is_supported_format(name))
            .map(|s| s.to_string())
            .collect();

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            path: path.clone(),
            archive: archive,
            entries: entries,
            cache: HashMap::new(),
        })
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs::File,
        io::Write,
        path::{self, Path},
    };
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
        let file = File::create(&zip_filepath).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::<()>::default()
            .compression_method(zip::CompressionMethod::DEFLATE)
            .unix_permissions(0o755);

        for (entry_name, content) in entries {
            zip.start_file(entry_name, options).unwrap();
            zip.write_all(content).unwrap();
        }
        zip.finish().unwrap();
        zip_filepath
    }

    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8,
        0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x53, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    #[test]
    fn test_new_valid_zip() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[
                ("image1.png", &DUMMY_PNG_DATA),
                ("image2.png", &DUMMY_PNG_DATA),
                ("text.txt", b"hello"),
            ],
        );

        let container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();

        assert_eq!(container.path, zip_path.to_str().unwrap());
        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
    }

    #[test]
    fn test_new_empty_zip() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "empty.zip", &[]);

        let container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();
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
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[
                ("image_c.png", &DUMMY_PNG_DATA),
                ("image_a.png", &DUMMY_PNG_DATA),
                ("image_b.png", &DUMMY_PNG_DATA),
            ],
        );

        let container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();
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
        let mut container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();

        let image = container.get_image(&String::from("image1.png")).unwrap();
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, DUMMY_PNG_DATA);

        // Ensure caching works
        let image_from_cache = container
            .get_image_from_cache(&String::from("image1.png"))
            .unwrap()
            .unwrap();
        assert_eq!(image.data, image_from_cache.data);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let mut container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();
        let result = container.get_image(&String::from("non_existent_image.png"));
        assert!(result.is_err());
    }

    #[test]
    fn test_preload() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(
            Path::new(dir.path()),
            "test.zip",
            &[
                ("image1.png", &DUMMY_PNG_DATA),
                ("image2.png", &DUMMY_PNG_DATA),
                ("image3.png", &DUMMY_PNG_DATA),
            ],
        );
        let mut container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();

        // Preload first two images
        container.preload(0, 2).unwrap();

        assert!(container.cache.contains_key(&String::from("image1.png")));
        assert!(container.cache.contains_key(&String::from("image2.png")));
        assert!(!container.cache.contains_key(&String::from("image3.png")));

        // Ensure getting a preloaded image works
        let image_1 = container.get_image(&String::from("image1.png")).unwrap();
        assert_eq!(image_1.width, 1);

        // Preload the remaining image
        container.preload(2, 1).unwrap();
        assert!(container.cache.contains_key(&String::from("image3.png")));
    }

    #[test]
    fn test_preload_out_of_bounds() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let mut container = ZipContainer::new(&zip_path.to_str().unwrap().to_string()).unwrap();

        // Attempt to preload beyond the number of entries
        container.preload(0, 5).unwrap();
        assert!(container.cache.contains_key(&String::from("image1.png")));
        assert_eq!(container.cache.len(), 1);

        container.preload(1, 1).unwrap(); // Should not add anything new
        assert_eq!(container.cache.len(), 1);
    }
}
