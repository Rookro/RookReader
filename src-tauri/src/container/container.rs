use std::{
    fmt::{Display, Formatter},
    sync::Arc,
};

use crate::container::image::Image;

/// Archive container
pub trait Container: Send + Sync + 'static {
    /// Retrieves a list of entries contained within the container.
    fn get_entries(&self) -> &Vec<String>;

    /// Retrieves an image from the cache.
    ///
    /// Returns `Arc<Image>` if the image is in the cache.
    ///
    /// * `entry` - The entry name of the image to retrieve.
    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError>;

    /// Retrieves an image from the file.
    ///
    /// * `entry` - The entry name of the image to retrieve.
    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError>;

    /// Preloads a specified number of images into the cache starting from a given index.
    ///
    /// * `begin_index` - The starting index.
    /// * `count` - The number of images to load.
    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError>;
}

impl dyn Container {
    /// Checks if the file extention is the supported archive format.
    ///
    /// The check is case-insensitive.
    ///
    /// * `filename` - The filename.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        lowercase_name.ends_with(".pdf")
            || lowercase_name.ends_with(".rar")
            || lowercase_name.ends_with(".zip")
    }
}

/// Error information for the archive container.
#[derive(Debug)]
pub struct ContainerError {
    /// Error message
    pub message: String,
    /// Path where the error occurred
    pub path: Option<String>,
    /// Entry where the error occurred
    pub entry: Option<String>,
}

impl Display for ContainerError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} (path: {}, entry: {})",
            self.message,
            self.path.clone().unwrap_or(String::from("None")),
            self.entry.clone().unwrap_or(String::from("None"))
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use rstest::*;

    use super::*;

    #[test]
    fn test_container_error_display_with_all_fields() {
        let error = ContainerError {
            message: "Test error".to_string(),
            path: Some("/path/to/file".to_string()),
            entry: Some("entry.png".to_string()),
        };

        let display_string = error.to_string();
        assert_eq!(
            "Test error (path: /path/to/file, entry: entry.png)",
            display_string
        );
    }

    #[test]
    fn test_container_error_display_without_path() {
        let error = ContainerError {
            message: "Test error".to_string(),
            path: None,
            entry: Some("entry.png".to_string()),
        };

        let display_string = error.to_string();
        assert_eq!("Test error (path: None, entry: entry.png)", display_string);
    }

    #[test]
    fn test_container_error_display_without_entry() {
        let error = ContainerError {
            message: "Test error".to_string(),
            path: Some("/path/to/file".to_string()),
            entry: None,
        };

        let display_string = error.to_string();
        assert_eq!(
            "Test error (path: /path/to/file, entry: None)",
            display_string
        );
    }

    #[test]
    fn test_container_error_display_without_path_and_entry() {
        let error = ContainerError {
            message: "Test error".to_string(),
            path: None,
            entry: None,
        };

        let display_string = error.to_string();
        assert_eq!("Test error (path: None, entry: None)", display_string);
    }

    #[rstest]
    #[case("document.pdf", true)]
    #[case("document.PDF", true)]
    #[case("archive.rar", true)]
    #[case("archive.RAR", true)]
    #[case("compressed.zip", true)]
    #[case("compressed.ZIP", true)]
    #[case("test.pdf.rar", true)]
    #[case(".pdf", true)]
    #[case(".rar", true)]
    #[case(".zip", true)]
    #[case("file.txt", false)]
    #[case("file.jpg", false)]
    #[case("file.png", false)]
    #[case("file.pdf_test", false)]
    #[case("file.rar.test", false)]
    #[case("document", false)]
    #[case("", false)]
    fn test_container_is_supported_format(#[case] filename: &str, #[case] expected: bool) {
        assert_eq!(
            expected,
            <dyn Container>::is_supported_format(filename),
            "Failed for filename: {}",
            filename
        );
    }
}
