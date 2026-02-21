use std::sync::Arc;

use crate::{container::image::Image, error::Result};

#[cfg(test)]
use mockall::{automock, predicate::*};

/// A trait representing a container for readable content, such as an archive file or a directory.
///
/// This trait defines a common interface for different types of containers to allow
/// abstracting over their specific implementations.
#[cfg_attr(test, automock)]
pub trait Container: Send + Sync + 'static {
    /// Returns a reference to a vector of entry names within the container.
    ///
    /// The entries are typically file names or paths inside an archive or directory.
    fn get_entries(&self) -> &Vec<String>;

    /// Retrieves a full-sized image for a given entry name.
    ///
    /// # Arguments
    ///
    /// * `entry` - The name of the entry corresponding to the image to be retrieved.
    ///
    /// # Returns
    ///
    /// A `Result` containing a shared pointer (`Arc`) to the `Image` data on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry cannot be found, read, or decoded into an image.
    fn get_image(&self, entry: &str) -> Result<Arc<Image>>;

    /// Retrieves a thumbnail-sized image for a given entry name.
    ///
    /// The default thumbnail size is defined by `Container::THUMBNAIL_SIZE`.
    ///
    /// # Arguments
    ///
    /// * `entry` - The name of the entry for which to retrieve a thumbnail.
    ///
    /// # Returns
    ///
    /// A `Result` containing a shared pointer (`Arc`) to the thumbnail `Image` data on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the entry cannot be found, or if the thumbnail cannot be
    /// generated or decoded.
    fn get_thumbnail(&self, entry: &str) -> Result<Arc<Image>>;

    /// Checks whether the container corresponds to a directory on the filesystem.
    ///
    /// # Returns
    ///
    /// Returns `true` if the container is a directory, `false` otherwise (e.g., it's a file).
    fn is_directory(&self) -> bool;
}

impl dyn Container {
    /// Checks if a given filename has a supported container file extension.
    ///
    /// The check is case-insensitive. Supported formats include "pdf", "rar", "zip", and "epub".
    ///
    /// # Arguments
    ///
    /// * `filename` - The filename to check.
    ///
    /// # Returns
    ///
    /// Returns `true` if the filename ends with a supported extension, `false` otherwise.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        lowercase_name.ends_with(".pdf")
            || lowercase_name.ends_with(".rar")
            || lowercase_name.ends_with(".zip")
            || lowercase_name.ends_with(".epub")
    }

    /// The target width and height in pixels for generated thumbnails.
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
