//! Turning a page's stored bytes into the image the viewer receives, at the size it is
//! displayed at.
//!
//! This is the only place that decodes, and the only place that resamples. A
//! [`PageReader`](crate::container::traits::PageReader) yields bytes and
//! [`PageService`](super::service::PageService) decides *when* they are read; what the
//! pixels end up being is decided here, and nowhere else.
//!
//! That the resample happens here at all is the point. Left to the browser, a page is
//! scaled by a 2x2 bilinear tap below a 2x reduction — under the Nyquist limit for a
//! screentone, which is moiré. A page fitted to the viewer's own box arrives at 1:1 and
//! the browser scales nothing.

use std::{io::Cursor, sync::Arc};

use image::{ImageFormat, ImageReader};

use crate::{
    error::Result,
    image::{
        resizer::{shrink_to_fit, ResizeFilter},
        thumbnail::generate_thumbnail,
        types::Image,
    },
};

/// The box a page is fitted into, in pixels. `u32::MAX` on an axis means nothing bounds it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Fit {
    /// The widest the page may come out.
    pub width: u32,
    /// The tallest the page may come out.
    pub height: u32,
}

impl Fit {
    /// The box of a viewer that has not said how large it draws a page.
    pub const UNBOUNDED: Fit = Fit {
        width: u32::MAX,
        height: u32::MAX,
    };

    /// Whether an image of this size is already inside the box.
    fn holds(self, width: u32, height: u32) -> bool {
        width <= self.width && height <= self.height
    }
}

/// How a page's encoded bytes become the image the viewer receives.
///
/// A value rather than a pair of arguments threaded through the scheduler: the scheduler
/// has no opinion about pixels, and rendering at the display size belongs here rather
/// than in the queue.
#[derive(Clone, Copy, Debug)]
pub struct Pipeline {
    /// The reader's viewport in device pixels, once the frontend has reported one.
    ///
    /// A page fitted to it is drawn without scaling, and the browser's own downscale — a
    /// 2x2 bilinear tap below a 2x reduction — is what puts moiré on a screentoned page.
    pub display: Option<Fit>,
    /// The height past which a page is shrunk whatever the viewport is. `0` is no limit.
    pub max_image_height: u32,
    /// The filter used when a page is shrunk.
    pub resize_method: ResizeFilter,
}

impl Pipeline {
    /// The box a page is fitted into for normal display.
    pub fn fit(&self) -> Fit {
        let display = self.display.unwrap_or(Fit::UNBOUNDED);
        Fit {
            width: display.width,
            height: self.capped(display.height),
        }
    }

    /// The box a page is fitted into when the viewer magnifies it.
    ///
    /// The loupe draws the page past 1:1, so the viewport does not bound it. The reader's
    /// own height cap still does.
    pub fn full_fit(&self) -> Fit {
        Fit {
            width: u32::MAX,
            height: self.capped(u32::MAX),
        }
    }

    /// `height`, brought down to `max_image_height` when one is set.
    fn capped(&self, height: u32) -> u32 {
        if self.max_image_height == 0 {
            height
        } else {
            height.min(self.max_image_height)
        }
    }

    /// Prepares one page for display: decode, fit into `fit`, re-encode.
    ///
    /// A page already inside the box is passed through untouched — no decode, no encode —
    /// so the bytes reach the viewer exactly as the archive stored them.
    ///
    /// # Arguments
    ///
    /// * `bytes` - The page's encoded bytes, as the reader delivered them.
    /// * `fit` - The box to render into, from [`Pipeline::fit`] or [`Pipeline::full_fit`].
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the bytes are not a supported image, or the resize fails.
    pub fn page(&self, bytes: Vec<u8>, fit: Fit) -> Result<Arc<Image>> {
        let image = Image::new(bytes)?;
        if fit.holds(image.width, image.height) {
            return Ok(Arc::new(image));
        }
        self.shrink(&image.data, fit)
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
    /// Associated rather than a method: a thumbnail's size is fixed by what displays it,
    /// so unlike [`Pipeline::page`] it owes nothing to the book's display settings. It
    /// lives here because this is the only module that decodes.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the bytes are not a supported image, or the resize fails.
    pub fn thumbnail(bytes: &[u8]) -> Result<Arc<Image>> {
        generate_thumbnail(bytes)
    }

    /// Resizes into `fit` and writes the result as PNG.
    ///
    /// Lossless, because the page is now drawn at 1:1 and a re-encode's artifacts would
    /// be shown at full size rather than blurred away by the browser's downscale. PNG is
    /// also the cheapest of the candidates a browser reads: `image`'s JPEG encoder is
    /// scalar pure Rust and takes 27-42 ms a page against PNG's 4-10 ms, and on line art
    /// it comes out larger as well.
    fn shrink(&self, data: &[u8], fit: Fit) -> Result<Arc<Image>> {
        let dyn_image = ImageReader::new(Cursor::new(data))
            .with_guessed_format()?
            .decode()?;

        // Use SIMD accelerated resizing.
        let scaled_image = shrink_to_fit(&dyn_image, fit.width, fit.height, self.resize_method)?;

        let mut buffer = Vec::new();
        scaled_image.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)?;

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

    /// A 4x2 opaque PNG of four saturated columns, so a resize is visible and a lossy
    /// re-encode of the result cannot come back unchanged.
    fn opaque_png() -> Vec<u8> {
        let mut source = image::RgbImage::new(4, 2);
        let columns = [[255u8, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];
        for (x, colour) in columns.iter().enumerate() {
            for y in 0..2 {
                source.put_pixel(x as u32, y, image::Rgb(*colour));
            }
        }

        let mut buffer = Vec::new();
        image::DynamicImage::ImageRgb8(source)
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

    fn decode(data: &[u8]) -> image::DynamicImage {
        ImageReader::new(Cursor::new(data))
            .with_guessed_format()
            .unwrap()
            .decode()
            .unwrap()
    }

    /// A pipeline with a height cap and no viewport, which is what shipped before pages
    /// were rendered at the display size.
    fn pipeline(max_image_height: u32) -> Pipeline {
        Pipeline {
            display: None,
            max_image_height,
            resize_method: ResizeFilter::Bilinear,
        }
    }

    /// A pipeline that renders into `width` x `height`, with no height cap.
    fn displaying(width: u32, height: u32) -> Pipeline {
        Pipeline {
            display: Some(Fit { width, height }),
            max_image_height: 0,
            resize_method: ResizeFilter::Bilinear,
        }
    }

    #[test]
    fn an_unbounded_fit_passes_bytes_through() {
        let bytes = opaque_png();
        let pipeline = pipeline(0);
        assert_eq!(pipeline.fit(), Fit::UNBOUNDED);

        // The shipped default before this change, and still the path a page takes before
        // the viewer has reported a viewport: the bytes reach it as the archive stored
        // them.
        let image = pipeline.page(bytes.clone(), pipeline.fit()).unwrap();
        assert_eq!(image.data, bytes);
        assert_eq!((image.width, image.height), (4, 2));
    }

    #[test]
    fn page_passes_bytes_through_when_already_inside_the_box() {
        let bytes = opaque_png();
        let pipeline = displaying(100, 100);
        let image = pipeline.page(bytes.clone(), pipeline.fit()).unwrap();
        assert_eq!(image.data, bytes);
    }

    #[test]
    fn page_shrinks_to_the_display_box() {
        let pipeline = displaying(2, 100);
        let image = pipeline.page(opaque_png(), pipeline.fit()).unwrap();

        // Width-bound: the box is narrower than the page but taller, and the aspect
        // ratio is kept. Only a `Fit` that carries both axes can express this.
        assert_eq!((image.width, image.height), (2, 1));
    }

    #[test]
    fn page_shrinks_to_the_height_cap() {
        let pipeline = pipeline(1);
        let image = pipeline.page(opaque_png(), pipeline.fit()).unwrap();
        assert_eq!((image.width, image.height), (2, 1));
    }

    #[test]
    fn the_height_cap_still_wins_inside_a_larger_box() {
        let pipeline = Pipeline {
            display: Some(Fit {
                width: 100,
                height: 100,
            }),
            max_image_height: 1,
            resize_method: ResizeFilter::Bilinear,
        };

        // The viewport would hold the page whole; the setting is what the user asked for.
        assert_eq!(
            pipeline.fit(),
            Fit {
                width: 100,
                height: 1
            }
        );
        let image = pipeline.page(opaque_png(), pipeline.fit()).unwrap();
        assert_eq!(image.height, 1);
    }

    #[test]
    fn full_fit_ignores_the_box_but_honours_the_height_cap() {
        let uncapped = displaying(2, 2);
        assert_eq!(uncapped.full_fit(), Fit::UNBOUNDED);
        let image = uncapped.page(opaque_png(), uncapped.full_fit()).unwrap();
        assert_eq!((image.width, image.height), (4, 2));

        let capped = Pipeline {
            display: Some(Fit {
                width: 2,
                height: 2,
            }),
            max_image_height: 1,
            resize_method: ResizeFilter::Bilinear,
        };
        assert_eq!(
            capped.full_fit(),
            Fit {
                width: u32::MAX,
                height: 1
            }
        );
    }

    #[test]
    fn a_shrunk_page_is_a_lossless_png() {
        let bytes = opaque_png();
        let pipeline = displaying(2, 100);
        let image = pipeline.page(bytes.clone(), pipeline.fit()).unwrap();

        assert_eq!(
            image::guess_format(&image.data).unwrap(),
            ImageFormat::Png,
            "the page is drawn at 1:1, so a re-encode's artifacts would be shown at full size"
        );

        // The bytes the viewer receives must decode back to the resize's own output,
        // pixel for pixel. This is the assertion the old JPEG encoder fails.
        let expected = shrink_to_fit(&decode(&bytes), 2, 100, ResizeFilter::Bilinear).unwrap();
        assert_eq!(decode(&image.data).to_rgb8(), expected.to_rgb8());
    }

    #[test]
    fn shrinking_keeps_alpha() {
        let pipeline = pipeline(1);
        let image = pipeline.page(alpha_png(), pipeline.fit()).unwrap();

        // Transparency survived the format change that made every page PNG; before it,
        // this was the one page that escaped being re-encoded as JPEG.
        assert_eq!(image::guess_format(&image.data).unwrap(), ImageFormat::Png);
        assert!(decode(&image.data).color().has_alpha());
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

        let thumbnail = Pipeline::thumbnail(&buffer).unwrap();
        assert!(thumbnail.width <= crate::image::thumbnail::THUMBNAIL_SIZE);
        assert!(thumbnail.height <= crate::image::thumbnail::THUMBNAIL_SIZE);
    }
}
