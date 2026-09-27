use std::io::Cursor;
use std::sync::Arc;

use image::{codecs::jpeg::JpegEncoder, DynamicImage, ImageReader};

use crate::{
    error::Result,
    image::{
        resizer::{shrink_to_fit, ResizeFilter},
        types::Image,
    },
};

/// How a thumbnail is sized and encoded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ThumbnailSpec {
    /// The widest and the tallest the thumbnail may be, in pixels.
    pub max_size: u32,
    /// The JPEG quality, from 1 to 100.
    pub quality: u8,
    /// The filter the source is shrunk with.
    pub filter: ResizeFilter,
    /// The long edge, in pixels, a PDF's embedded thumbnail needs before it is used in
    /// place of a render. `0` accepts any.
    pub min_embedded_size: u32,
}

/// The reader's stand-in while a PDF page renders: quick to make, not meant to be looked at.
pub const PREVIEW: ThumbnailSpec = ThumbnailSpec {
    max_size: 300,
    quality: 10,
    filter: ResizeFilter::Bilinear,
    min_embedded_size: 0,
};

/// A bookshelf cover. The large grid size shows a cover in about 208×300 CSS px, which
/// is 600 device px tall at 200% display scaling.
pub const COVER: ThumbnailSpec = ThumbnailSpec {
    max_size: 600,
    quality: 80,
    filter: ResizeFilter::Lanczos3,
    // Embedded thumbnails are usually far smaller, and an upscaled one looks coarse.
    min_embedded_size: 600,
};

/// Generates a JPEG thumbnail from raw image data.
///
/// # Arguments
///
/// * `data` - The raw binary data of the source image.
/// * `spec` - The size and encoding of the thumbnail.
///
/// # Returns
///
/// A `Result` containing a shared pointer to the generated thumbnail `Image`.
///
/// # Errors
///
/// Returns an `Err` if the image data cannot be decoded or the resizing/encoding fails.
pub fn generate_thumbnail(data: &[u8], spec: &ThumbnailSpec) -> Result<Arc<Image>> {
    let dyn_image = ImageReader::new(Cursor::new(data))
        .with_guessed_format()?
        .decode()?;
    Ok(Arc::new(encode_thumbnail(&dyn_image, spec)?))
}

/// Shrinks a decoded image to fit `spec` and encodes it as JPEG.
///
/// # Arguments
///
/// * `image` - The decoded source image.
/// * `spec` - The size and encoding of the thumbnail.
///
/// # Returns
///
/// The encoded thumbnail and its dimensions.
///
/// # Errors
///
/// Returns an `Err` if the resizing or the encoding fails.
pub fn encode_thumbnail(image: &DynamicImage, spec: &ThumbnailSpec) -> Result<Image> {
    let thumbnail = shrink_to_fit(image, spec.max_size, spec.max_size, spec.filter)?;

    let mut buffer = Vec::new();
    JpegEncoder::new_with_quality(&mut buffer, spec.quality).encode_image(&thumbnail)?;

    Ok(Image {
        data: buffer,
        width: thumbnail.width(),
        height: thumbnail.height(),
    })
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
        let result = generate_thumbnail(DUMMY_PNG_DATA, &PREVIEW);
        assert!(result.is_ok());

        let thumbnail = result.unwrap();
        assert!(thumbnail.width <= PREVIEW.max_size);
        assert!(thumbnail.height <= PREVIEW.max_size);
        assert!(!thumbnail.data.is_empty());
    }

    #[test]
    fn test_generate_thumbnail_from_an_avif() {
        let thumbnail = generate_thumbnail(&crate::image::avif::tests::avif(), &PREVIEW).unwrap();
        assert_eq!((thumbnail.width, thumbnail.height), (8, 4));
    }

    #[test]
    fn test_generate_thumbnail_invalid_data() {
        let invalid_data = vec![0xFF, 0xD8, 0xFF, 0xE0];
        let result = generate_thumbnail(&invalid_data, &PREVIEW);
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_thumbnail_empty_data() {
        let result = generate_thumbnail(&[], &PREVIEW);
        assert!(result.is_err());
    }
}
