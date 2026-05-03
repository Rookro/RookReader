use crate::error::{Error, Result};
use fast_image_resize::{ResizeAlg, ResizeOptions, Resizer};
use image::{imageops::FilterType, DynamicImage, RgbaImage};
use std::num::NonZeroU32;

/// A helper function to map `image::imageops::FilterType` to `fast_image_resize::ResizeAlg`
pub fn filter_to_resize_alg(filter: FilterType) -> ResizeAlg {
    match filter {
        FilterType::Nearest => ResizeAlg::Nearest,
        FilterType::Triangle => ResizeAlg::Convolution(fast_image_resize::FilterType::Bilinear),
        FilterType::CatmullRom => ResizeAlg::Convolution(fast_image_resize::FilterType::CatmullRom),
        FilterType::Gaussian => ResizeAlg::Convolution(fast_image_resize::FilterType::Box), // Approximation
        FilterType::Lanczos3 => ResizeAlg::Convolution(fast_image_resize::FilterType::Lanczos3),
    }
}

/// Resizes a `DynamicImage` to the exact specified width and height using SIMD.
pub fn fast_resize_exact(
    img: &DynamicImage,
    target_width: u32,
    target_height: u32,
    filter: FilterType,
) -> Result<DynamicImage> {
    if target_width == 0 || target_height == 0 {
        return Err(Error::Other(
            "Target dimensions must be greater than 0".into(),
        ));
    }

    let dst_width = NonZeroU32::new(target_width).unwrap();
    let dst_height = NonZeroU32::new(target_height).unwrap();

    // Using Rgba8 as a universal buffer for simplicity, or we can create an empty image of the same type.
    // To handle all types gracefully, let's create a destination buffer of the same type if possible.
    // fast_image_resize supports image::ImageBuffer.
    // For simplicity, we convert to Rgba8 if needed, but fast_image_resize "image" feature can use DynamicImage but we need a mutable destination.
    // Let's create an empty RgbaImage as the destination.
    let mut dst_image = RgbaImage::new(dst_width.get(), dst_height.get());

    let mut resizer = Resizer::new();
    let alg = filter_to_resize_alg(filter);

    // We use img.into_rgba8() to ensure a consistent pixel format if img is not RGBA.
    // However, it's more memory efficient to keep it in its original format.
    // Let's just use DynamicImage::ImageRgba8 as the output.
    let src_rgba = img.to_rgba8();

    let options = ResizeOptions::new().resize_alg(alg);

    resizer
        .resize(&src_rgba, &mut dst_image, &options)
        .map_err(|e| Error::Other(format!("Image resize failed: {}", e)))?;

    Ok(DynamicImage::ImageRgba8(dst_image))
}

/// Resizes a `DynamicImage` so it fits within the specified `max_width` and `max_height`
/// while preserving the original aspect ratio.
pub fn fast_thumbnail(
    img: &DynamicImage,
    max_width: u32,
    max_height: u32,
    filter: FilterType,
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

    fast_resize_exact(img, target_width, target_height, filter)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[test]
    fn test_fast_resize_exact() {
        let img =
            DynamicImage::ImageRgba8(ImageBuffer::from_pixel(100, 100, Rgba([255, 0, 0, 255])));
        let resized = fast_resize_exact(&img, 50, 50, FilterType::Lanczos3).unwrap();
        assert_eq!(resized.width(), 50);
        assert_eq!(resized.height(), 50);
    }

    #[test]
    fn test_fast_thumbnail_aspect_ratio() {
        let img =
            DynamicImage::ImageRgba8(ImageBuffer::from_pixel(200, 100, Rgba([255, 0, 0, 255])));

        // Scale down to max 50x50. Original is 2:1, so target should be 50x25
        let thumb = fast_thumbnail(&img, 50, 50, FilterType::Lanczos3).unwrap();
        assert_eq!(thumb.width(), 50);
        assert_eq!(thumb.height(), 25);

        // Scale down width only (max_height is MAX)
        let thumb2 = fast_thumbnail(&img, 100, u32::MAX, FilterType::Lanczos3).unwrap();
        assert_eq!(thumb2.width(), 100);
        assert_eq!(thumb2.height(), 50);
    }
}
