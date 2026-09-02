//! Turning a page's stored bytes into the image the viewer receives.
//!
//! This is the only place that decodes. A [`PageReader`](crate::container::traits::PageReader)
//! yields bytes and [`PageService`](super::service::PageService) decides *when* they are
//! read; what the pixels end up being is decided here, and nowhere else.

use std::{io::Cursor, sync::Arc};

use image::{codecs::jpeg::JpegEncoder, ImageFormat, ImageReader};

use crate::{
    error::Result,
    image::{
        resizer::{shrink_to_fit, ResizeFilter},
        thumbnail::generate_thumbnail,
        types::Image,
    },
};

/// How a page's encoded bytes become the image the viewer receives.
///
/// A value rather than a pair of arguments threaded through the scheduler: the scheduler
/// has no opinion about pixels, and a later change — rendering at the display size, say —
/// belongs here rather than in the queue.
#[derive(Clone, Copy, Debug)]
pub struct Pipeline {
    /// The height past which a page is shrunk. `0` leaves every page at its stored size.
    pub max_image_height: u32,
    /// The filter used when a page is shrunk.
    pub resize_method: ResizeFilter,
}

impl Pipeline {
    /// Prepares one page for display: decode, shrink past `max_image_height`, re-encode.
    ///
    /// A page already within the height is passed through untouched, which for the shipped
    /// default (`max_image_height = 0`) is every page — the bytes reach the viewer exactly
    /// as the archive stored them.
    ///
    /// # Arguments
    ///
    /// * `bytes` - The page's encoded bytes, as the reader delivered them.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the bytes are not a supported image, or the resize fails.
    pub fn page(&self, bytes: Vec<u8>) -> Result<Arc<Image>> {
        let image = Image::new(bytes)?;
        if self.max_image_height == 0 || image.height <= self.max_image_height {
            return Ok(Arc::new(image));
        }
        self.shrink(&image.data, self.max_image_height)
    }

    /// Wraps a preview the format produced at a size of its own choosing.
    ///
    /// Nothing is resized here: a format only answers `read_preview` when it can render
    /// small directly, so shrinking its answer again would undo the point of asking.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the bytes are not a supported image.
    pub fn preview(&self, bytes: Vec<u8>) -> Result<Arc<Image>> {
        Ok(Arc::new(Image::new(bytes)?))
    }

    /// Shrinks a full page to the thumbnail contract, for a format with no preview of
    /// its own.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the bytes are not a supported image, or the resize fails.
    pub fn thumbnail(&self, bytes: &[u8]) -> Result<Arc<Image>> {
        generate_thumbnail(bytes)
    }

    /// Decodes, shrinks to `height`, and re-encodes.
    ///
    /// Images with an alpha channel are re-encoded as PNG to preserve transparency;
    /// opaque images are re-encoded as JPEG (quality 80) to minimize transferred bytes.
    fn shrink(&self, data: &[u8], height: u32) -> Result<Arc<Image>> {
        let dyn_image = ImageReader::new(Cursor::new(data))
            .with_guessed_format()?
            .decode()?;

        // Use SIMD accelerated resizing.
        // max_width is u32::MAX to scale based entirely on height.
        let scaled_image = shrink_to_fit(&dyn_image, u32::MAX, height, self.resize_method)?;

        let mut buffer = Vec::new();
        if scaled_image.color().has_alpha() {
            scaled_image.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)?;
        } else {
            JpegEncoder::new_with_quality(&mut buffer, 80).encode_image(&scaled_image)?;
        }

        Ok(Arc::new(Image {
            data: buffer,
            width: scaled_image.width(),
            height: scaled_image.height(),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A 4x2 opaque PNG, wide enough that a height cap has something to shrink.
    fn opaque_png() -> Vec<u8> {
        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .expect("failed to encode the fixture");
        buffer
    }

    /// The same size, but with an alpha channel.
    fn alpha_png() -> Vec<u8> {
        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgba8(image::RgbaImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .expect("failed to encode the fixture");
        buffer
    }

    fn pipeline(max_image_height: u32) -> Pipeline {
        Pipeline {
            max_image_height,
            resize_method: ResizeFilter::Bilinear,
        }
    }

    #[test]
    fn page_passes_bytes_through_when_no_height_is_set() {
        let bytes = opaque_png();
        let image = pipeline(0).page(bytes.clone()).unwrap();

        // The shipped default is 0, and on that path a page must reach the viewer exactly
        // as the archive stored it.
        assert_eq!(image.data, bytes);
        assert_eq!((image.width, image.height), (4, 2));
    }

    #[test]
    fn page_passes_bytes_through_when_already_short_enough() {
        let bytes = opaque_png();
        let image = pipeline(100).page(bytes.clone()).unwrap();
        assert_eq!(image.data, bytes);
    }

    #[test]
    fn page_shrinks_to_the_height_cap() {
        let image = pipeline(1).page(opaque_png()).unwrap();
        assert_eq!(image.height, 1);
        assert_eq!(image.width, 2);
    }

    #[test]
    fn shrinking_keeps_alpha_as_png() {
        let image = pipeline(1).page(alpha_png()).unwrap();

        // Re-encoding a transparent page as JPEG would replace its transparency with
        // black, so the format has to follow the pixels rather than a fixed choice.
        assert_eq!(
            image::guess_format(&image.data).unwrap(),
            ImageFormat::Png,
            "a page with an alpha channel must stay PNG"
        );
        assert!(ImageReader::new(Cursor::new(&image.data))
            .with_guessed_format()
            .unwrap()
            .decode()
            .unwrap()
            .color()
            .has_alpha());
    }

    #[test]
    fn shrinking_encodes_an_opaque_page_as_jpeg() {
        let image = pipeline(1).page(opaque_png()).unwrap();
        assert_eq!(
            image::guess_format(&image.data).unwrap(),
            ImageFormat::Jpeg,
            "an opaque page costs fewer bytes as JPEG"
        );
    }

    #[test]
    fn preview_is_left_at_the_size_its_format_chose() {
        let bytes = opaque_png();
        // Even with a height cap below the preview's own height, nothing is resized: a
        // format only offers a preview when it can render small directly.
        let preview = pipeline(1).preview(bytes.clone()).unwrap();
        assert_eq!(preview.data, bytes);
        assert_eq!(preview.height, 2);
    }

    #[test]
    fn thumbnail_shrinks_to_the_thumbnail_contract() {
        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(2000, 1000))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();

        let thumbnail = pipeline(0).thumbnail(&buffer).unwrap();
        assert!(thumbnail.width <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(thumbnail.height <= crate::image::thumbnail::THUMBNAIL_SIZE);
    }
}
