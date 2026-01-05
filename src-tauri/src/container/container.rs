use pdfium_render::prelude::PdfiumError;
use std::{num::ParseIntError, sync::Arc};
use thiserror::Error;

use crate::container::image::Image;

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
    fn get_image(&self, entry: &String) -> ContainerResult<Arc<Image>>;

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
    }
}

/// Error information for the archive container.
#[derive(Debug, Error)]
pub enum ContainerError {
    /// IO related errors.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    /// PDFium related errors.
    #[error("PDFium error: {0}")]
    Pdfium(#[from] PdfiumError),
    /// Image related errors.
    #[error("Image error: {0}")]
    Image(#[from] image::ImageError),
    /// Unrar related errors.
    #[error("Unrar error: {0}")]
    Unrar(#[from] unrar::error::UnrarError),
    /// Zip related errors.
    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    /// Parse int related errors.
    #[error("Parse int error: {0}")]
    ParseInt(#[from] ParseIntError),
    /// Other errors.
    #[error("Container error: {0}")]
    Other(String),
}

impl From<String> for ContainerError {
    fn from(message: String) -> Self {
        ContainerError::Other(message)
    }
}

/// A specialized Result type for the container.
pub type ContainerResult<T> = std::result::Result<T, ContainerError>;

#[cfg(test)]
mod tests {
    use rstest::*;

    use super::*;

    #[test]
    fn test_container_error_display() {
        let io_error = ContainerError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "file not found",
        ));
        assert!(io_error.to_string().contains("file not found"));

        let other_error = ContainerError::Other("Something went wrong".to_string());
        assert!(other_error.to_string().contains("Something went wrong"));
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
