use std::sync::Arc;

use crate::{container::image::Image, error::Result};

#[cfg(test)]
use mockall::{automock, predicate::*};

/// Archive container
#[cfg_attr(test, automock)]
pub trait Container: Send + Sync + 'static {
    /// Retrieves a list of entries contained within the container.
    fn get_entries(&self) -> &Vec<String>;

    /// Retrieves an image from the file.
    ///
    /// Returns `Arc<Image>` if the image is in the cache.
    ///
    /// * `entry` - The entry name of the image to retrieve.
    fn get_image(&self, entry: &String) -> Result<Arc<Image>>;

    /// Retrieves a thumbnail from the file.
    ///
    /// # Arguments
    ///
    /// * `entry` - The entry name of the thumbnail to retrieve.
    ///
    /// # Returns
    ///
    /// `Arc<Image>` if the thumbnail retrieved successfully.
    fn get_thumbnail(&self, entry: &String) -> Result<Arc<Image>>;

    /// Checks if the container is a directory.
    ///
    /// Returns true if it is a directory, false if it is a file.
    fn is_directory(&self) -> bool;
}

impl dyn Container {
    /// Checks if the file extention is the supported archive format.
    ///
    /// The check is case-insensitive.
    ///
    /// Returns whether the file is supported.
    ///
    /// * `filename` - The filename.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        lowercase_name.ends_with(".pdf")
            || lowercase_name.ends_with(".rar")
            || lowercase_name.ends_with(".zip")
            || lowercase_name.ends_with(".epub")
    }

    /// The size of the thumbnail in pixels.
    pub const THUMBNAIL_SIZE: u32 = 300;
}

#[cfg(test)]
mod tests {
    use rstest::*;

    use super::*;

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
