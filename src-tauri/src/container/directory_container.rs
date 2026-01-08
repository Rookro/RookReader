use std::{
    fs::{read_dir, File},
    io::Read,
    path,
    sync::Arc,
};

use crate::container::{
    container::{Container, ContainerError, ContainerResult},
    image::Image,
};

/// A container for directories.
pub struct DirectoryContainer {
    /// The directory path.
    path: String,
    /// The entries in the directory.
    entries: Vec<String>,
}

impl Container for DirectoryContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&self, entry: &String) -> ContainerResult<Arc<Image>> {
        let image_arc = load_image(&self.path, entry)?;
        Ok(image_arc)
    }

    fn is_directory(&self) -> bool {
        true
    }
}

impl DirectoryContainer {
    /// Creates a new DirectoryContainer.
    ///
    /// * `path` - The directory path.
    pub fn new(path: &String) -> ContainerResult<Self> {
        let dir_entries = read_dir(path)?;

        let mut entries: Vec<String> = Vec::new();
        for entry_result in dir_entries {
            let entry = entry_result?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                continue;
            }
            let file_name = entry.file_name().into_string().map_err(|e| {
                ContainerError::Other(format!(
                    "failed to get file name from DirEntry. {}",
                    e.display()
                ))
            })?;

            if Image::is_supported_format(&file_name) {
                entries.push(file_name);
            }
        }

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            path: path.clone(),
            entries: entries,
        })
    }
}

/// Loads an image from the specified entry name.
///
/// * `path` - The path of the container directory.
/// * `entry` - The entry name of the image to get.
fn load_image(path: &String, entry: &String) -> ContainerResult<Arc<Image>> {
    let file_path = path::Path::new(&path).join(entry);
    let mut buffer = Vec::new();
    File::open(file_path)?.read_to_end(&mut buffer)?;

    Ok(Arc::new(Image::new(buffer)?))
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
        let mut file = File::create(&filepath).expect("failed to create dummy image file");
        // A minimal valid PNG (1x1 transparent pixel)
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC,
            0x53, 0x24, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        file.write_all(&png_data).expect("failed to write png data");
        filepath
    }

    #[test]
    fn test_new_valid_directory() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "test1.png");
        create_dummy_image(dir.path(), "test2.jpg");
        fs::File::create(dir.path().join("test.txt")).expect("failed to create test.txt"); // Not supported

        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "test1.png");
        assert_eq!(container.entries[1], "test2.jpg");
    }

    #[test]
    fn test_new_empty_directory() {
        let dir = tempdir().expect("failed to create tempdir");
        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
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
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "a.png");
        create_dummy_image(dir.path(), "b.jpg");

        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
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
        let dir = tempdir().expect("failed to create tempdir");
        for file in unsorted_files {
            create_dummy_image(dir.path(), file);
        }

        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
        let entries = container.get_entries();

        let expected_sorted_strings: Vec<String> = expected_sorted_files
            .into_iter()
            .map(String::from)
            .collect();

        assert_eq!(entries, &expected_sorted_strings);
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "test.png");
        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");

        let image = container
            .get_image(&String::from("test.png"))
            .expect("get_image should succeed for existing image");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
        let result = container.get_image(&String::from("non_existent.png"));
        assert!(result.is_err());
    }
}
