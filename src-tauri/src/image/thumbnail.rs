use std::io::Cursor;
use std::sync::Arc;

use image::{codecs::jpeg::JpegEncoder, ImageReader};

use crate::{
    error::Result,
    image::{
        resizer::{shrink_to_fit, ResizeFilter},
        types::Image,
    },
};

/// The target width and height in pixels for generated thumbnails.
pub const THUMBNAIL_SIZE: u32 = 300;

/// Generates a JPEG thumbnail from raw image data using SIMD-accelerated resizing.
///
/// This function decodes the provided image data, shrinks it to fit within
/// `THUMBNAIL_SIZE`, and encodes the result as a low-quality JPEG.
///
/// # Arguments
///
/// * `data` - The raw binary data of the source image.
///
/// # Returns
///
/// A `Result` containing a shared pointer to the generated thumbnail `Image`.
///
/// # Errors
///
/// Returns an `Err` if the image data cannot be decoded or the resizing/encoding fails.
pub fn generate_thumbnail(data: &[u8]) -> Result<Arc<Image>> {
    let cursor = Cursor::new(data);
    let image_reader = ImageReader::new(cursor).with_guessed_format()?;
    let dyn_image = image_reader.decode()?;

    let thumbnail = shrink_to_fit(
        &dyn_image,
        THUMBNAIL_SIZE,
        THUMBNAIL_SIZE,
        ResizeFilter::Bilinear,
    )?;

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

#[cfg(test)]
mod tests {
    use super::*;

    // A valid 1x1 transparent PNG
    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    #[test]
    fn test_generate_thumbnail_valid_image() {
        let result = generate_thumbnail(DUMMY_PNG_DATA);
        assert!(result.is_ok());

        let thumbnail = result.unwrap();
        assert!(thumbnail.width <= THUMBNAIL_SIZE);
        assert!(thumbnail.height <= THUMBNAIL_SIZE);
        assert!(!thumbnail.data.is_empty());
    }

    #[test]
    fn test_generate_thumbnail_invalid_data() {
        let invalid_data = vec![0xFF, 0xD8, 0xFF, 0xE0];
        let result = generate_thumbnail(&invalid_data);
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_thumbnail_empty_data() {
        let result = generate_thumbnail(&[]);
        assert!(result.is_err());
    }
}
