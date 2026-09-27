use std::io::Cursor;

use image::{
    codecs::{gif::GifDecoder, png::PngDecoder, webp::WebPDecoder},
    metadata::Orientation,
    AnimationDecoder, ImageDecoder, ImageFormat, ImageReader,
};
use serde::{Deserialize, Serialize};

use super::avif;

/// Bytes a reader takes from the front of a page before falling back to a full read when
/// it only needs the dimensions. A PNG `IHDR` sits in the first 33 bytes, a JPEG `SOF`
/// marker within the first few KiB even behind a large EXIF block, and an AVIF's `meta`
/// box precedes its coded pixels — so this bound turns a 200-page scan into a header probe.
pub const HEADER_PROBE_BYTES: u64 = 64 * 1024;

/// The pixel dimensions of a single image, without its data.
#[derive(Serialize, Deserialize, specta::Type, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ImageDimensions {
    /// The width of the image in pixels.
    pub width: u32,
    /// The height of the image in pixels.
    pub height: u32,
}

/// Reads an image's dimensions from its header, without decoding the pixel data.
///
/// The size is the one the viewer shows: a page stored on its side and turned upright by
/// its orientation tag has its width and height swapped here, so the pairing decided from
/// these numbers matches the page on screen.
///
/// # Arguments
///
/// * `data` - The encoded bytes of an image file.
///
/// # Returns
///
/// A `Result` containing the image's dimensions on success.
///
/// # Errors
///
/// Returns an `image::ImageError` if the format cannot be guessed or the header is
/// not a supported image.
pub fn read_dimensions(data: &[u8]) -> Result<ImageDimensions, image::ImageError> {
    let image_reader = ImageReader::new(Cursor::new(data)).with_guessed_format()?;
    // `image`'s AVIF decoder decodes the whole picture to learn its size; the container
    // states it up front.
    if image_reader.format() == Some(ImageFormat::Avif) {
        let stored = avif::read_dimensions(data)?;
        return Ok(oriented(stored, avif::orientation(data)?));
    }
    // The decoder is built, not run: this reads the header (and the EXIF block, when
    // there is one) and allocates nothing for pixels.
    let mut decoder = image_reader.into_decoder()?;
    let (width, height) = decoder.dimensions();
    let orientation = decoder.orientation()?;
    Ok(oriented(ImageDimensions { width, height }, orientation))
}

/// The stored size as it will be displayed once `orientation` has been applied.
fn oriented(stored: ImageDimensions, orientation: Orientation) -> ImageDimensions {
    match orientation {
        Orientation::Rotate90
        | Orientation::Rotate270
        | Orientation::Rotate90FlipH
        | Orientation::Rotate270FlipH => ImageDimensions {
            width: stored.height,
            height: stored.width,
        },
        _ => stored,
    }
}

/// Whether an encoded image carries more than one frame.
///
/// Reads only what each format needs to answer: the PNG and WebP headers, and for GIF
/// up to two frames, since its container does not announce a frame count.
///
/// # Arguments
///
/// * `data` - The encoded bytes of an image file.
///
/// # Returns
///
/// `true` for an animated GIF, APNG or animated WebP; `false` for every other image.
///
/// # Errors
///
/// Returns an `image::ImageError` if the bytes look like a GIF, PNG or WebP whose header
/// cannot be read.
pub fn is_animated(data: &[u8]) -> Result<bool, image::ImageError> {
    let reader = ImageReader::new(Cursor::new(data)).with_guessed_format()?;
    let animated = match reader.format() {
        Some(ImageFormat::Gif) => GifDecoder::new(reader.into_inner())?
            .into_frames()
            .nth(1)
            .is_some(),
        Some(ImageFormat::Png) => PngDecoder::new(reader.into_inner())?.is_apng()?,
        Some(ImageFormat::WebP) => WebPDecoder::new(reader.into_inner())?.has_animation(),
        _ => false,
    };
    Ok(animated)
}

/// Represents image data and its dimensions.
#[derive(Clone, Debug)]
pub struct Image {
    /// The raw binary data of the image file.
    pub data: Vec<u8>,
    /// The width of the image in pixels.
    pub width: u32,
    /// The height of the image in pixels.
    pub height: u32,
}

impl Image {
    /// Creates a new `Image` instance from raw binary data.
    ///
    /// This function decodes the provided data to determine the image's width and
    /// height. The original binary data is stored alongside the dimensions.
    ///
    /// # Arguments
    ///
    /// * `data` - A vector of bytes representing the binary data of an image.
    ///
    /// # Returns
    ///
    /// A `Result` containing a new `Image` instance on success.
    ///
    /// # Errors
    ///
    /// Returns an `image::ImageError` if the provided data cannot be decoded as a
    /// supported image format.
    pub fn new(data: Vec<u8>) -> Result<Self, image::ImageError> {
        let ImageDimensions { width, height } = read_dimensions(&data)?;
        Ok(Image {
            data,
            width,
            height,
        })
    }

    /// Checks if a filename has a supported image file extension.
    ///
    /// Supported formats are based on common web formats like PNG, JPEG, GIF, WebP and AVIF.
    /// The check is case-insensitive.
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
        lowercase_name.ends_with(".apng")
            || lowercase_name.ends_with(".avif")
            || lowercase_name.ends_with(".gif")
            || lowercase_name.ends_with(".jpg")
            || lowercase_name.ends_with(".jpeg")
            || lowercase_name.ends_with(".jpe")
            || lowercase_name.ends_with(".jif")
            || lowercase_name.ends_with(".jfif")
            || lowercase_name.ends_with(".png")
            || lowercase_name.ends_with(".webp")
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use image::{codecs::gif::GifEncoder, DynamicImage, Frame, RgbImage, Rgba, RgbaImage};
    use rstest::*;

    use super::*;

    /// A 4x2 two-frame GIF.
    pub(crate) fn animated_gif() -> Vec<u8> {
        let mut buffer = Vec::new();
        {
            let mut encoder = GifEncoder::new(&mut buffer);
            let frames = [[255u8, 0, 0, 255], [0, 0, 255, 255]]
                .map(|px| Frame::new(RgbaImage::from_pixel(4, 2, Rgba(px))));
            encoder.encode_frames(frames).unwrap();
        }
        buffer
    }

    /// A 4x2 single-frame GIF.
    fn still_gif() -> Vec<u8> {
        let mut buffer = Vec::new();
        DynamicImage::ImageRgba8(RgbaImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Gif)
            .unwrap();
        buffer
    }

    /// A 4x2 two-frame APNG. `image` cannot write one, so this goes through `png` directly.
    fn apng() -> Vec<u8> {
        let mut buffer = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut buffer, 4, 2);
            encoder.set_color(png::ColorType::Rgb);
            encoder.set_animated(2, 0).unwrap();
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(&[0u8; 24]).unwrap();
            writer.write_image_data(&[255u8; 24]).unwrap();
            writer.finish().unwrap();
        }
        buffer
    }

    fn still_png() -> Vec<u8> {
        let mut buffer = Vec::new();
        DynamicImage::ImageRgb8(RgbImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();
        buffer
    }

    /// A minimal little-endian EXIF block whose only entry is the Orientation tag.
    fn exif_orientation(value: u16) -> Vec<u8> {
        let mut exif = Vec::new();
        exif.extend_from_slice(b"II*\0"); // TIFF header, little endian
        exif.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset
        exif.extend_from_slice(&1u16.to_le_bytes()); // one entry
        exif.extend_from_slice(&0x0112u16.to_le_bytes()); // Orientation
        exif.extend_from_slice(&3u16.to_le_bytes()); // SHORT
        exif.extend_from_slice(&1u32.to_le_bytes()); // count
        exif.extend_from_slice(&value.to_le_bytes());
        exif.extend_from_slice(&0u16.to_le_bytes()); // padding to 4 bytes
        exif.extend_from_slice(&0u32.to_le_bytes()); // next IFD: none
        exif
    }

    /// A 4x2 JPEG tagged with the given EXIF orientation.
    fn tagged_jpeg(orientation: u16) -> Vec<u8> {
        use image::ImageEncoder;

        let mut buffer = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new(&mut buffer);
        encoder
            .set_exif_metadata(exif_orientation(orientation))
            .unwrap();
        encoder
            .encode_image(&DynamicImage::ImageRgb8(RgbImage::new(4, 2)))
            .unwrap();
        buffer
    }

    fn still_webp() -> Vec<u8> {
        let mut buffer = Vec::new();
        DynamicImage::ImageRgb8(RgbImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::WebP)
            .unwrap();
        buffer
    }

    /// A 4x2 two-frame animated WebP. `image-webp` only writes stills, so the animated
    /// container is assembled by hand around the VP8L chunk it produced.
    fn animated_webp() -> Vec<u8> {
        fn chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
            let mut out = fourcc.to_vec();
            out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
            out.extend_from_slice(payload);
            if payload.len() % 2 == 1 {
                out.push(0);
            }
            out
        }

        // A simple-format still is "RIFF" + size + "WEBP" + the VP8L chunk.
        let still = still_webp();
        let vp8l_chunk = &still[12..];

        // ANMF: x/2, y/2, width-1, height-1, duration (3 bytes each), flags, then the frame.
        let mut frame = vec![0, 0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 100, 0, 0, 0];
        frame.extend_from_slice(vp8l_chunk);
        let anmf = chunk(b"ANMF", &frame);

        let mut body = b"WEBP".to_vec();
        // VP8X: flags (0x02 = animation), reserved, canvas width-1 and height-1 (3 bytes each).
        body.extend(chunk(b"VP8X", &[0x02, 0, 0, 0, 3, 0, 0, 1, 0, 0]));
        // ANIM: background colour, loop count 0 (forever).
        body.extend(chunk(b"ANIM", &[0, 0, 0, 0, 0, 0]));
        body.extend_from_slice(&anmf);
        body.extend_from_slice(&anmf);

        let mut out = b"RIFF".to_vec();
        out.extend_from_slice(&(body.len() as u32).to_le_bytes());
        out.extend(body);
        out
    }

    fn jpeg() -> Vec<u8> {
        let mut buffer = Vec::new();
        DynamicImage::ImageRgb8(RgbImage::new(4, 2))
            .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg)
            .unwrap();
        buffer
    }

    #[rstest]
    #[case::animated_gif(animated_gif(), true)]
    #[case::still_gif(still_gif(), false)]
    #[case::apng(apng(), true)]
    #[case::still_png(still_png(), false)]
    #[case::animated_webp(animated_webp(), true)]
    #[case::still_webp(still_webp(), false)]
    #[case::avif(crate::image::avif::tests::avif(), false)]
    #[case::jpeg(jpeg(), false)]
    fn test_is_animated(#[case] data: Vec<u8>, #[case] expected: bool) {
        // Every fixture must be something the pipeline would accept in the first place.
        assert!(Image::new(data.clone()).is_ok());
        assert_eq!(is_animated(&data).unwrap(), expected);
    }

    #[test]
    fn test_is_animated_with_truncated_header() {
        assert!(is_animated(b"GIF89a").is_err());
    }

    #[test]
    fn test_is_animated_with_unknown_format() {
        assert!(!is_animated(b"not an image").unwrap());
    }

    #[rstest]
    #[case("test.apng", true)]
    #[case("test.APNG", true)]
    #[case("test.avif", true)]
    #[case("test.AVIF", true)]
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
    #[case("test.svg", false)]
    #[case("test.SVG", false)]
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

        let image = result.expect("Image::new should succeed for a valid PNG");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, png_data);
    }

    #[test]
    fn test_read_dimensions_without_decoding_the_pixel_data() {
        // A 1x1 PNG whose IHDR is intact but whose IDAT payload is garbage. Reading the
        // dimensions must still succeed, proving no pixel data is decoded; a full decode
        // of the same bytes fails.
        let mut corrupt_idat = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0x99, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x7F, 0x00, 0x09, 0xFB, 0x03, 0xFD, 0xDE, 0x54,
            0x4D, 0xEE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        // Overwrite the IDAT chunk's 12-byte payload (it starts right after the type tag).
        corrupt_idat[41..53].fill(0xFF);

        let dimensions =
            read_dimensions(&corrupt_idat).expect("the IHDR alone must be enough for dimensions");
        assert_eq!(
            dimensions,
            ImageDimensions {
                width: 1,
                height: 1
            }
        );
        assert!(image::load_from_memory(&corrupt_idat).is_err());
    }

    #[rstest]
    #[case::rotate_90(6, (2, 4))]
    #[case::rotate_270(8, (2, 4))]
    #[case::rotate_90_flip(5, (2, 4))]
    #[case::rotate_270_flip(7, (2, 4))]
    #[case::rotate_180(3, (4, 2))]
    #[case::flip_horizontal(2, (4, 2))]
    #[case::upright(1, (4, 2))]
    fn a_tagged_jpeg_is_measured_as_displayed(
        #[case] orientation: u16,
        #[case] expected: (u32, u32),
    ) {
        let dims = read_dimensions(&tagged_jpeg(orientation)).unwrap();
        assert_eq!((dims.width, dims.height), expected);
    }

    #[test]
    fn an_untagged_png_keeps_its_stored_size() {
        let dims = read_dimensions(&still_png()).unwrap();
        assert_eq!((dims.width, dims.height), (4, 2));
    }

    #[test]
    fn a_rotated_avif_is_measured_as_displayed() {
        // `ispe` says 8x4; `irot` 1 turns it upright to 4x8.
        let data = crate::image::avif::tests::transformed_avif(&[(b"irot", &[1u8][..])]);
        let dims = read_dimensions(&data).unwrap();
        assert_eq!((dims.width, dims.height), (4, 8));
    }

    #[test]
    fn test_read_dimensions_of_an_avif_without_decoding_it() {
        // A 200-page scan must not run dav1d once per page: the size comes from the header
        // alone, so a probe that stops short of `mdat` is enough.
        let data = crate::image::avif::tests::avif();
        let mdat = data.windows(4).position(|w| w == b"mdat").unwrap();
        assert_eq!(
            read_dimensions(&data[..mdat - 4]).unwrap(),
            ImageDimensions {
                width: 8,
                height: 4
            }
        );
    }

    #[test]
    fn test_read_dimensions_with_invalid_data() {
        assert!(read_dimensions(&[0xFF, 0xD8, 0xFF, 0xE0]).is_err());
    }

    #[test]
    fn test_image_new_with_invalid_data() {
        // Invalid image data
        let invalid_data = vec![0xFF, 0xD8, 0xFF, 0xE0];

        let result = Image::new(invalid_data);
        assert!(result.is_err());
    }

    #[test]
    fn test_image_new_with_empty_data() {
        let empty_data = vec![];

        let result = Image::new(empty_data);
        assert!(result.is_err());
    }
}
