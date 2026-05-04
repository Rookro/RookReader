use crate::error::{Error, Result};
use fast_image_resize::{ResizeAlg, ResizeOptions, Resizer};
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;

/// The algorithms to use when resampling images.
///
/// This enum wraps the algorithms supported by `fast_image_resize`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResizeFilter {
    /// Nearest neighbor interpolation. Fastest, but lowest quality.
    Nearest,
    /// Box filter.
    Box,
    /// Bilinear interpolation (Triangle filter).
    Bilinear,
    /// Hamming filter.
    Hamming,
    /// Catmull-Rom interpolation.
    CatmullRom,
    /// Mitchell-Netravali interpolation.
    MitchellNetravali,
    /// Lanczos3 interpolation. Highest quality, but slowest.
    Lanczos3,
}

impl From<ResizeFilter> for ResizeAlg {
    fn from(filter: ResizeFilter) -> Self {
        match filter {
            ResizeFilter::Nearest => ResizeAlg::Nearest,
            ResizeFilter::Box => ResizeAlg::Convolution(fast_image_resize::FilterType::Box),
            ResizeFilter::Bilinear => {
                ResizeAlg::Convolution(fast_image_resize::FilterType::Bilinear)
            }
            ResizeFilter::Hamming => ResizeAlg::Convolution(fast_image_resize::FilterType::Hamming),
            ResizeFilter::CatmullRom => {
                ResizeAlg::Convolution(fast_image_resize::FilterType::CatmullRom)
            }
            ResizeFilter::MitchellNetravali => {
                ResizeAlg::Convolution(fast_image_resize::FilterType::Mitchell)
            }
            ResizeFilter::Lanczos3 => {
                ResizeAlg::Convolution(fast_image_resize::FilterType::Lanczos3)
            }
        }
    }
}

/// Resizes a `DynamicImage` to the exact specified width and height using SIMD.
///
/// This function utilizes `fast_image_resize` to perform the operation efficiently.
/// It matches the input `DynamicImage` variant to use the optimal buffer format
/// (e.g., Luma8, Rgb8) and avoids unnecessary conversions. Unhandled formats
/// are converted to Rgba8 before resizing.
///
/// # Arguments
///
/// * `img` - A reference to the source `DynamicImage` to be resized.
/// * `target_width` - The exact width in pixels for the output image. Must be greater than 0.
/// * `target_height` - The exact height in pixels for the output image. Must be greater than 0.
/// * `filter` - The interpolation algorithm (`ResizeFilter`) to use for resampling.
///
/// # Returns
///
/// Returns a `Result` containing the resized `DynamicImage` on success.
///
/// # Errors
///
/// Returns an `Error` if the target width or height is 0, or if the underlying
/// resizing operation fails.
pub fn resize_exact(
    img: &DynamicImage,
    target_width: u32,
    target_height: u32,
    filter: ResizeFilter,
) -> Result<DynamicImage> {
    let dst_width = NonZeroU32::new(target_width)
        .ok_or_else(|| Error::Other("Target width must be greater than 0".into()))?;
    let dst_height = NonZeroU32::new(target_height)
        .ok_or_else(|| Error::Other("Target height must be greater than 0".into()))?;

    let mut resizer = Resizer::new();
    let alg = ResizeAlg::from(filter);
    let options = ResizeOptions::new().resize_alg(alg);
    let options_alpha = ResizeOptions::new().resize_alg(alg).use_alpha(true);

    macro_rules! resize_to {
        ($src:expr, $image_type:path, $variant:ident, $options:expr) => {{
            let mut dst_image = $image_type(dst_width.get(), dst_height.get());
            resizer.resize($src, &mut dst_image, $options)?;
            Ok(DynamicImage::$variant(dst_image))
        }};
    }

    match img {
        DynamicImage::ImageLuma8(src_image) => {
            resize_to!(src_image, image::GrayImage::new, ImageLuma8, &options)
        }
        DynamicImage::ImageLumaA8(src_image) => {
            resize_to!(
                src_image,
                image::GrayAlphaImage::new,
                ImageLumaA8,
                &options_alpha
            )
        }
        DynamicImage::ImageRgb8(src_image) => {
            resize_to!(src_image, image::RgbImage::new, ImageRgb8, &options)
        }
        DynamicImage::ImageRgba8(src_image) => {
            resize_to!(src_image, image::RgbaImage::new, ImageRgba8, &options_alpha)
        }
        DynamicImage::ImageLuma16(src_image) => {
            resize_to!(src_image, image::ImageBuffer::new, ImageLuma16, &options)
        }
        DynamicImage::ImageLumaA16(src_image) => {
            resize_to!(
                src_image,
                image::ImageBuffer::new,
                ImageLumaA16,
                &options_alpha
            )
        }
        DynamicImage::ImageRgb16(src_image) => {
            resize_to!(src_image, image::ImageBuffer::new, ImageRgb16, &options)
        }
        DynamicImage::ImageRgba16(src_image) => {
            resize_to!(
                src_image,
                image::ImageBuffer::new,
                ImageRgba16,
                &options_alpha
            )
        }
        DynamicImage::ImageRgb32F(src_image) => {
            resize_to!(src_image, image::ImageBuffer::new, ImageRgb32F, &options)
        }
        DynamicImage::ImageRgba32F(src_image) => {
            resize_to!(
                src_image,
                image::ImageBuffer::new,
                ImageRgba32F,
                &options_alpha
            )
        }
        _ => {
            // Fallback for other formats: convert to Rgba8
            let src_rgba = img.to_rgba8();
            let mut dst_image = image::RgbaImage::new(dst_width.get(), dst_height.get());
            resizer.resize(&src_rgba, &mut dst_image, &options_alpha)?;
            Ok(DynamicImage::ImageRgba8(dst_image))
        }
    }
}

/// Resizes a `DynamicImage` so it fits within the specified maximum dimensions
/// while preserving the original aspect ratio.
///
/// If the original image is already smaller than or equal to the maximum dimensions,
/// it is returned unmodified (cloned). The function scales down the image using
/// the provided filter but will never scale it up. You can pass `u32::MAX` for
/// either `max_width` or `max_height` to constrain the scaling by only one dimension.
///
/// # Arguments
///
/// * `img` - A reference to the source `DynamicImage`.
/// * `max_width` - The maximum allowable width in pixels. Must be greater than 0.
/// * `max_height` - The maximum allowable height in pixels. Must be greater than 0.
/// * `filter` - The interpolation algorithm (`ResizeFilter`) to use for resampling.
///
/// # Returns
///
/// Returns a `Result` containing the resized `DynamicImage` on success.
///
/// # Errors
///
/// Returns an `Error` if any of the source or maximum dimensions are 0, or if the
/// underlying resizing operation fails.
pub fn shrink_to_fit(
    img: &DynamicImage,
    max_width: u32,
    max_height: u32,
    filter: ResizeFilter,
) -> Result<DynamicImage> {
    let src_width = img.width();
    let src_height = img.height();

    if src_width == 0 || src_height == 0 || max_width == 0 || max_height == 0 {
        return Err(Error::Other("Invalid image or max dimensions".into()));
    }

    // Calculate aspect ratio preserving dimensions
    let width_ratio = max_width as f64 / src_width as f64;
    let height_ratio = max_height as f64 / src_height as f64;

    let ratio = if max_width == u32::MAX {
        height_ratio
    } else if max_height == u32::MAX {
        width_ratio
    } else {
        f64::min(width_ratio, height_ratio)
    };

    if ratio >= 1.0 {
        // Image is already smaller than or equal to max dimensions
        return Ok(img.clone());
    }

    let target_width = (src_width as f64 * ratio).round() as u32;
    let target_height = (src_height as f64 * ratio).round() as u32;

    let target_width = target_width.max(1);
    let target_height = target_height.max(1);

    resize_exact(img, target_width, target_height, filter)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[test]
    fn test_resize_exact() {
        let img =
            DynamicImage::ImageRgba8(ImageBuffer::from_pixel(100, 100, Rgba([255, 0, 0, 255])));
        let resized = resize_exact(&img, 50, 50, ResizeFilter::Lanczos3).unwrap();
        assert_eq!(resized.width(), 50);
        assert_eq!(resized.height(), 50);
    }

    #[test]
    fn test_shrink_to_fit_aspect_ratio() {
        let img =
            DynamicImage::ImageRgba8(ImageBuffer::from_pixel(200, 100, Rgba([255, 0, 0, 255])));

        // Scale down to max 50x50. Original is 2:1, so target should be 50x25
        let thumb = shrink_to_fit(&img, 50, 50, ResizeFilter::Lanczos3).unwrap();
        assert_eq!(thumb.width(), 50);
        assert_eq!(thumb.height(), 25);

        // Scale down width only (max_height is MAX)
        let thumb2 = shrink_to_fit(&img, 100, u32::MAX, ResizeFilter::Lanczos3).unwrap();
        assert_eq!(thumb2.width(), 100);
        assert_eq!(thumb2.height(), 50);
    }
}
