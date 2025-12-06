use std::{
    collections::HashMap,
    fs::{read_dir, File},
    io::Read,
    path,
    sync::Arc,
};

use crate::container::{
    container::{Container, ContainerError},
    image::Image,
};

/// A container for directories.
pub struct DirectoryContainer {
    /// The directory path.
    path: String,
    /// The entries in the directory.
    entries: Vec<String>,
    /// The image cache.(key: entry name, value: image)
    cache: HashMap<String, Arc<Image>>,
}

impl Container for DirectoryContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            return Ok(Arc::clone(&image_arc));
        }

        let image_arc = self.load_image(entry)?;
        Ok(image_arc)
    }

    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        for i in begin_index..end {
            // If it's already in the cache, skip it.
            let entry = self.entries[i].clone();
            if self.cache.contains_key(&entry) {
                log::debug!("Hit cache so skip preload index: {}", i);
                continue;
            }

            self.load_image(&entry)?;
        }
        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError> {
        Ok(self.cache.get(entry).map(|arc| Arc::clone(arc)))
    }
}

impl DirectoryContainer {
    /// Creates a new DirectoryContainer.
    ///
    /// * `path` - The directory path.
    pub fn new(path: &String) -> Result<Self, ContainerError> {
        let dir_entries = read_dir(path).map_err(|e| ContainerError {
            message: e.to_string(),
            path: Some(path.clone()),
            entry: None,
        })?;

        let mut entries: Vec<String> = Vec::new();
        for entry in dir_entries {
            let entry = entry.map_err(|e| ContainerError {
                message: e.to_string(),
                path: Some(path.clone()),
                entry: None,
            })?;
            let file_type = entry.file_type().map_err(|e| ContainerError {
                message: e.to_string(),
                path: Some(path.clone()),
                entry: None,
            })?;

            if file_type.is_dir() {
                continue;
            }
            let file_name = entry
                .file_name()
                .into_string()
                .map_err(|e| ContainerError {
                    message: format!("failed to get file name from DirEntry. {}", e.display()),
                    path: Some(path.clone()),
                    entry: None,
                })?;

            if Image::is_supported_format(&file_name) {
                entries.push(file_name);
            }
        }

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            path: path.clone(),
            entries: entries,
            cache: HashMap::new(),
        })
    }

    /// Loads an image from the specified entry name.
    ///
    /// * `entry` - The entry name of the image to get.
    fn load_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        let file_path = path::Path::new(&self.path).join(entry);
        let mut buffer = Vec::new();
        File::open(file_path)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to open the image file. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?
            .read_to_end(&mut buffer)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to read the image file. {}", e)),
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
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File},
        io::Write,
    };

    use rstest::rstest;
    use tempfile::tempdir;

    use super::*;

    // Create a dummy image file for testing.
    fn create_dummy_image(dir: &path::Path, filename: &str) -> path::PathBuf {
        let filepath = dir.join(filename);
        let mut file = File::create(&filepath).unwrap();
        // A minimal valid PNG (1x1 transparent pixel)
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC,
            0x53, 0x24, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        file.write_all(&png_data).unwrap();
        filepath
    }

    #[test]
    fn test_new_valid_directory() {
        let dir = tempdir().unwrap();
        create_dummy_image(dir.path(), "test1.png");
        create_dummy_image(dir.path(), "test2.jpg");
        fs::File::create(dir.path().join("test.txt")).unwrap(); // Not supported

        let container = DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "test1.png");
        assert_eq!(container.entries[1], "test2.jpg");
    }

    #[test]
    fn test_new_empty_directory() {
        let dir = tempdir().unwrap();
        let container = DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();
        assert!(container.entries.is_empty());
    }

    #[test]
    fn test_new_non_existent_directory() {
        let non_existent_path = String::from("/non/existent/path");
        let container = DirectoryContainer::new(&non_existent_path);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().unwrap();
        create_dummy_image(dir.path(), "a.png");
        create_dummy_image(dir.path(), "b.jpg");

        let container = DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0], "a.png");
        assert_eq!(entries[1], "b.jpg");
    }

    #[rstest]
    #[case(vec!["b.png", "a.jpg"], vec!["a.jpg", "b.png"])]
    #[case(vec!["10.png", "2.png", "1.png"], vec!["1.png", "2.png", "10.png"])]
    fn test_get_entries_sorted(
        #[case] unsorted_files: Vec<&str>,
        #[case] expected_sorted_files: Vec<&str>,
    ) {
        let dir = tempdir().unwrap();
        for file in unsorted_files {
            create_dummy_image(dir.path(), file);
        }

        let container = DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();
        let entries = container.get_entries();

        let expected_sorted_strings: Vec<String> = expected_sorted_files
            .into_iter()
            .map(String::from)
            .collect();

        assert_eq!(entries, &expected_sorted_strings);
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        create_dummy_image(dir.path(), "test.png");
        let mut container =
            DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();

        let image = container.get_image(&String::from("test.png")).unwrap();
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);

        // Ensure caching works
        let image_from_cache = container
            .get_image_from_cache(&String::from("test.png"))
            .unwrap()
            .unwrap();
        assert_eq!(image.data, image_from_cache.data);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let mut container =
            DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();
        let result = container.get_image(&String::from("non_existent.png"));
        assert!(result.is_err());
    }

    #[test]
    fn test_preload() {
        let dir = tempdir().unwrap();
        create_dummy_image(dir.path(), "1.png");
        create_dummy_image(dir.path(), "2.png");
        create_dummy_image(dir.path(), "3.png");

        let mut container =
            DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();

        // Preload first two images
        container.preload(0, 2).unwrap();

        assert!(container.cache.contains_key(&String::from("1.png")));
        assert!(container.cache.contains_key(&String::from("2.png")));
        assert!(!container.cache.contains_key(&String::from("3.png")));

        // Ensure getting a preloaded image works
        let image_1 = container.get_image(&String::from("1.png")).unwrap();
        assert_eq!(image_1.width, 1);

        // Preload the remaining image
        container.preload(2, 1).unwrap();
        assert!(container.cache.contains_key(&String::from("3.png")));
    }

    #[test]
    fn test_preload_out_of_bounds() {
        let dir = tempdir().unwrap();
        create_dummy_image(dir.path(), "1.png");
        let mut container =
            DirectoryContainer::new(&dir.path().to_str().unwrap().to_string()).unwrap();

        // Attempt to preload beyond the number of entries
        container.preload(0, 5).unwrap();
        assert!(container.cache.contains_key(&String::from("1.png")));
        assert_eq!(container.cache.len(), 1);

        container.preload(1, 1).unwrap(); // Should not add anything new
        assert_eq!(container.cache.len(), 1);
    }
}
