use std::io::Cursor;

use image::ImageReader;
use serde::{Deserialize, Serialize};

/// Image data
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Image {
    /// Binary data of the image
    pub data: Vec<u8>,
    /// Width of the image
    pub width: u32,
    /// Height of the image
    pub height: u32,
}

impl Image {
    /// Creates an Image instance from binary image data.
    ///
    /// * `data` - The binary data of the image.
    pub fn new(data: Vec<u8>) -> Result<Self, String> {
        let cursor = Cursor::new(&data);
        let image_reader = ImageReader::new(cursor)
            .with_guessed_format()
            .map_err(|e| format!("Failed to create Image instance. {}", e))?;
        match image_reader.into_dimensions() {
            Ok((width, height)) => Ok(Image {
                data: data,
                width,
                height,
            }),
            Err(e) => {
                let error_message = format!("Failed to get image size. {}", e);
                log::error!("{}", error_message);
                return Err(error_message);
            }
        }
    }

    /// Checks if the file extention is the supported image format.
    ///
    /// Supported image formats are based on [MDN's <img> supported image formats](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#supported_image_formats).
    /// This method is case-insensitive.
    ///
    /// * `filename` - The filename.
    pub fn is_supported_format(filename: &str) -> bool {
        let lowercase_name = filename.to_lowercase();
        lowercase_name.ends_with(".apng")
            // AVIF images are not supported because image crate require a external library for avif support.
            //|| lowercase_name.ends_with(".avif")
            || lowercase_name.ends_with(".gif")
            || lowercase_name.ends_with(".jpg")
            || lowercase_name.ends_with(".jpeg")
            || lowercase_name.ends_with(".jpe")
            || lowercase_name.ends_with(".jif")
            || lowercase_name.ends_with(".jfif")
            || lowercase_name.ends_with(".png")
            || lowercase_name.ends_with(".svg")
            || lowercase_name.ends_with(".webp")
    }
}

#[cfg(test)]
mod tests {
    use rstest::*;

    use super::*;

    #[rstest]
    #[case("test.apng", true)]
    #[case("test.APNG", true)]
    #[case("test.avif", false)] // Currently not supported
    #[case("test.AVIF", false)] // Currently not supported
    #[case("test.gif", true)]
    #[case("test.GIF", true)]
    #[case("test.jpg", true)]
    #[case("test.JPG", true)]
    #[case("test.jpeg", true)]
    #[case("test.JPEG", true)]
    #[case("test.jpe", true)]
    #[case("test.JPE", true)]
    #[case("test.jif", true)]
    #[case("test.JIF", true)]
    #[case("test.jfif", true)]
    #[case("test.JFIF", true)]
    #[case("test.png", true)]
    #[case("test.PNG", true)]
    #[case("test.svg", true)]
    #[case("test.SVG", true)]
    #[case("test.webp", true)]
    #[case("test.WEBP", true)]
    #[case("test.test.png", true)]
    #[case(".png", true)]
    #[case("test.png_test", false)]
    #[case("test.png.test", false)]
    #[case("test.pdf", false)]
    #[case("test.rar", false)]
    #[case("test.zip", false)]
    #[case("test", false)]
    #[case("", false)]
    fn test_image_is_supported_format(#[case] filename: &str, #[case] expected: bool) {
        assert_eq!(
            expected,
            Image::is_supported_format(filename),
            "Failed for filename: {}",
            filename
        );
    }

    #[test]
    fn test_image_new_with_valid_png() {
        // 1x1 PNG image data (minimal valid PNG)
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0x99, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x7F, 0x00, 0x09, 0xFB, 0x03, 0xFD, 0xDE, 0x54,
            0x4D, 0xEE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];

        let result = Image::new(png_data.clone());
        assert!(result.is_ok());

        let image = result.unwrap();
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, png_data);
    }

    #[test]
    fn test_image_new_with_invalid_data() {
        // Invalid image data
        let invalid_data = vec![0xFF, 0xD8, 0xFF, 0xE0];

        let result = Image::new(invalid_data);
        assert!(result.is_err());
        let error_msg = result.unwrap_err();
        assert!(
            error_msg.contains("Failed to create Image instance")
                || error_msg.contains("Failed to get image size"),
            "Error message was: {}",
            error_msg
        );
    }

    #[test]
    fn test_image_new_with_empty_data() {
        let empty_data = vec![];

        let result = Image::new(empty_data);
        assert!(result.is_err());

        let error_msg = result.unwrap_err();
        assert!(
            error_msg.contains("Failed to create Image instance")
                || error_msg.contains("Failed to get image size"),
            "Error message was: {}",
            error_msg
        );
    }
}
