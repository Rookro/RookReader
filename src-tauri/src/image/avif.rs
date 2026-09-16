//! What an AVIF's container says about its primary item, read without decoding it.
//!
//! An AVIF is an ISOBMFF file: boxes laid end to end, each a big-endian 32-bit size (of the
//! whole box), a four-character type and a payload; a `FullBox` payload starts with a
//! version byte and 24 bits of flags. Everything read here sits in `meta`, which precedes
//! the coded pixels in `mdat`, so a header probe is enough. `image`'s own decoder decodes
//! the whole picture just to report its size, and reports no orientation at all.

use image::{
    error::{DecodingError, ImageFormatHint},
    metadata::Orientation,
    ImageError, ImageFormat,
};

use super::types::ImageDimensions;

/// A box's type and payload.
type IsoBox<'a> = ([u8; 4], &'a [u8]);

fn u16_at(data: &[u8], at: usize) -> Option<u16> {
    Some(u16::from_be_bytes(data.get(at..at + 2)?.try_into().ok()?))
}

fn u32_at(data: &[u8], at: usize) -> Option<u32> {
    Some(u32::from_be_bytes(data.get(at..at + 4)?.try_into().ok()?))
}

/// The boxes laid end to end in `data`, in order. Stops at the first malformed one.
fn boxes(mut data: &[u8]) -> impl Iterator<Item = IsoBox<'_>> {
    std::iter::from_fn(move || {
        let size = u32_at(data, 0)?;
        let kind: [u8; 4] = data.get(4..8)?.try_into().ok()?;
        let (header, end) = match size {
            0 => (8, data.len()),
            1 => {
                let large = u64::from_be_bytes(data.get(8..16)?.try_into().ok()?);
                (16, usize::try_from(large).ok()?)
            }
            _ => (8, size as usize),
        };
        let payload = data.get(header..end)?;
        data = &data[end..];
        Some((kind, payload))
    })
}

/// The payload of the first `kind` box among `data`'s boxes.
fn child<'a>(data: &'a [u8], kind: &[u8; 4]) -> Option<&'a [u8]> {
    boxes(data)
        .find(|(k, _)| k == kind)
        .map(|(_, payload)| payload)
}

/// A FullBox's version, flags, and the payload after them.
fn full_box(payload: &[u8]) -> Option<(u8, u32, &[u8])> {
    let head = u32_at(payload, 0)?;
    Some(((head >> 24) as u8, head & 0x00FF_FFFF, &payload[4..]))
}

/// The property boxes `ipma` associates with the primary item, in association order.
fn primary_item_properties(data: &[u8]) -> Option<Vec<IsoBox<'_>>> {
    let (_, _, meta) = full_box(child(data, b"meta")?)?;
    let (version, _, pitm) = full_box(child(meta, b"pitm")?)?;
    let primary_item = if version == 0 {
        u32::from(u16_at(pitm, 0)?)
    } else {
        u32_at(pitm, 0)?
    };

    let iprp = child(meta, b"iprp")?;
    // `ipma` indexes into `ipco` from 1.
    let properties: Vec<IsoBox<'_>> = boxes(child(iprp, b"ipco")?).collect();
    let (version, flags, ipma) = full_box(child(iprp, b"ipma")?)?;
    let wide_index = (flags & 1) == 1;

    let mut at = 4;
    for _ in 0..u32_at(ipma, 0)? {
        let item = if version == 0 {
            let id = u16_at(ipma, at)?;
            at += 2;
            u32::from(id)
        } else {
            let id = u32_at(ipma, at)?;
            at += 4;
            id
        };
        let count = usize::from(*ipma.get(at)?);
        at += 1;
        let mut associated = Vec::with_capacity(count);
        for _ in 0..count {
            // The top bit is the "essential" flag; the rest is the 1-based index.
            let index = if wide_index {
                let i = u16_at(ipma, at)? & 0x7FFF;
                at += 2;
                usize::from(i)
            } else {
                let i = *ipma.get(at)? & 0x7F;
                at += 1;
                usize::from(i)
            };
            if let Some(property) = index.checked_sub(1).and_then(|i| properties.get(i)) {
                associated.push(*property);
            }
        }
        if item == primary_item {
            return Some(associated);
        }
    }
    None
}

fn invalid(reason: &'static str) -> ImageError {
    ImageError::Decoding(DecodingError::new(
        ImageFormatHint::Exact(ImageFormat::Avif),
        reason,
    ))
}

/// Reads the primary item's dimensions from its `ispe` property.
///
/// # Arguments
///
/// * `data` - An AVIF file, or at least its `meta` box.
///
/// # Returns
///
/// The coded width and height, before any `irot` is applied.
///
/// # Errors
///
/// Returns an `image::ImageError` if the bytes carry no primary item with an `ispe`.
pub fn read_dimensions(data: &[u8]) -> Result<ImageDimensions, ImageError> {
    primary_item_properties(data)
        .and_then(|properties| {
            let (_, ispe) = properties.into_iter().find(|(kind, _)| kind == b"ispe")?;
            let (_, _, ispe) = full_box(ispe)?;
            Some(ImageDimensions {
                width: u32_at(ispe, 0)?,
                height: u32_at(ispe, 4)?,
            })
        })
        .ok_or_else(|| invalid("the primary item has no ispe property"))
}

/// The transform `irot` and `imir` ask the viewer to apply, as an EXIF-style orientation.
///
/// `irot` is counter-clockwise quarter turns; `imir`'s axis bit exchanges top and bottom
/// when `0` and left and right when `1`. AVIF applies the rotation first, then the mirror.
///
/// # Arguments
///
/// * `data` - An AVIF file, or at least its `meta` box.
///
/// # Errors
///
/// Returns an `image::ImageError` if the bytes carry no primary item.
pub fn orientation(data: &[u8]) -> Result<Orientation, ImageError> {
    let properties = primary_item_properties(data).ok_or_else(|| invalid("no primary item"))?;
    let property = |kind: &[u8; 4]| {
        properties
            .iter()
            .find(|(k, _)| k == kind)
            .and_then(|(_, payload)| payload.first().copied())
    };
    let angle = property(b"irot").map_or(0, |byte| byte & 3);
    let mirror = property(b"imir").map(|byte| byte & 1);

    use Orientation::*;
    Ok(match (angle, mirror) {
        (0, None) => NoTransforms,
        (1, None) => Rotate270,
        (2, None) => Rotate180,
        (_, None) => Rotate90,
        (0, Some(0)) => FlipVertical,
        (0, Some(_)) => FlipHorizontal,
        (1, Some(0)) => Rotate90FlipH,
        (1, Some(_)) => Rotate270FlipH,
        (2, Some(0)) => FlipHorizontal,
        (2, Some(_)) => FlipVertical,
        (_, Some(0)) => Rotate270FlipH,
        (_, Some(_)) => Rotate90FlipH,
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use std::io::Cursor;

    use image::{DynamicImage, GenericImageView, RgbImage};
    use rstest::*;

    use super::*;

    /// An 8x4 opaque AVIF written by `image`'s own (ravif) encoder.
    pub(crate) fn avif() -> Vec<u8> {
        let mut buffer = Vec::new();
        DynamicImage::ImageRgb8(RgbImage::from_fn(8, 4, |x, _| {
            image::Rgb([x as u8 * 32, 0, 0])
        }))
        .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Avif)
        .unwrap();
        buffer
    }

    fn boxed(kind: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut out = ((8 + payload.len()) as u32).to_be_bytes().to_vec();
        out.extend_from_slice(kind);
        out.extend_from_slice(payload);
        out
    }

    fn full(kind: &[u8; 4], version: u8, payload: &[u8]) -> Vec<u8> {
        let mut body = vec![version, 0, 0, 0];
        body.extend_from_slice(payload);
        boxed(kind, &body)
    }

    /// `avif()` re-wrapped by hand in a container of our own, so that `irot` and `imir` —
    /// which no encoder we have writes — can be attached to the primary item as essential
    /// properties. `transforms` are `(type, payload)` boxes appended to `ipco`.
    pub(crate) fn transformed_avif(transforms: &[(&[u8; 4], &[u8])]) -> Vec<u8> {
        let encoded = avif();
        let (_, _, meta) = full_box(child(&encoded, b"meta").unwrap()).unwrap();
        let ipco = child(child(meta, b"iprp").unwrap(), b"ipco").unwrap();
        let av1c = child(ipco, b"av1C").unwrap();
        let coded = child(&encoded, b"mdat").unwrap();

        let ftyp = boxed(b"ftyp", b"avif\0\0\0\0avifmif1");

        // ipco: 1 ispe, 2 av1C (essential), 3 pixi, 4.. the transforms (essential).
        let mut properties = vec![
            full(b"ispe", 0, &[0, 0, 0, 8, 0, 0, 0, 4]),
            boxed(b"av1C", av1c),
            full(b"pixi", 0, &[3, 8, 8, 8]),
        ];
        let mut associations = vec![0x01, 0x82, 0x03];
        for (i, (kind, payload)) in transforms.iter().enumerate() {
            properties.push(boxed(kind, payload));
            associations.push(0x80 | (4 + i as u8));
        }
        // ipma v0: entry_count, item 1, association_count, associations.
        let mut ipma = vec![0, 0, 0, 1, 0, 1, associations.len() as u8];
        ipma.extend(associations);
        let iprp = boxed(
            b"iprp",
            &[
                boxed(b"ipco", &properties.concat()),
                full(b"ipma", 0, &ipma),
            ]
            .concat(),
        );

        let mut hdlr = vec![0; 4];
        hdlr.extend_from_slice(b"pict");
        hdlr.extend_from_slice(&[0; 13]);
        let mut iinf = vec![0, 1];
        iinf.extend(full(b"infe", 2, b"\0\x01\0\0av01\0"));
        // iloc v0: 4-byte offsets and lengths, no base offset, one item with one extent
        // whose offset is absolute in the file — so the meta box is built twice: once to
        // learn its size, once with the real offset.
        let meta = |offset: u32| {
            let mut iloc = vec![0x44, 0x00, 0, 1, 0, 1, 0, 0, 0, 1];
            iloc.extend_from_slice(&offset.to_be_bytes());
            iloc.extend_from_slice(&(coded.len() as u32).to_be_bytes());
            full(
                b"meta",
                0,
                &[
                    full(b"hdlr", 0, &hdlr),
                    full(b"pitm", 0, &[0, 1]),
                    full(b"iloc", 0, &iloc),
                    full(b"iinf", 0, &iinf),
                    iprp.clone(),
                ]
                .concat(),
            )
        };
        let offset = (ftyp.len() + meta(0).len() + 8) as u32;
        [ftyp, meta(offset), boxed(b"mdat", coded)].concat()
    }

    /// The bytes before `mdat`: what a 64 KiB header probe of a large page would see.
    fn header_only(data: &[u8]) -> &[u8] {
        let mdat = data.windows(4).position(|w| w == b"mdat").unwrap();
        &data[..mdat - 4]
    }

    #[test]
    fn read_dimensions_uses_ispe() {
        assert_eq!(
            read_dimensions(&avif()).unwrap(),
            ImageDimensions {
                width: 8,
                height: 4
            }
        );
    }

    #[test]
    fn read_dimensions_needs_only_the_header() {
        let data = avif();
        assert_eq!(
            read_dimensions(header_only(&data)).unwrap(),
            ImageDimensions {
                width: 8,
                height: 4
            }
        );
    }

    #[test]
    fn read_dimensions_rejects_other_bytes() {
        assert!(read_dimensions(b"not an avif").is_err());
        assert!(read_dimensions(&[]).is_err());
    }

    #[test]
    fn the_hand_built_container_decodes() {
        // The fixture the transform tests rely on must be a real AVIF to `image` too.
        let image = image::load_from_memory(&transformed_avif(&[])).unwrap();
        assert_eq!(image.dimensions(), (8, 4));
        assert_eq!(
            read_dimensions(&transformed_avif(&[])).unwrap(),
            ImageDimensions {
                width: 8,
                height: 4
            }
        );
    }

    #[rstest]
    #[case::none(&[], Orientation::NoTransforms)]
    #[case::rotate_ccw_90(&[(b"irot", &[1u8][..])], Orientation::Rotate270)]
    #[case::rotate_180(&[(b"irot", &[2u8][..])], Orientation::Rotate180)]
    #[case::rotate_ccw_270(&[(b"irot", &[3u8][..])], Orientation::Rotate90)]
    #[case::mirror_top_bottom(&[(b"imir", &[0u8][..])], Orientation::FlipVertical)]
    #[case::mirror_left_right(&[(b"imir", &[1u8][..])], Orientation::FlipHorizontal)]
    #[case::rotate_then_mirror(&[(b"irot", &[1u8][..]), (b"imir", &[1u8][..])], Orientation::Rotate270FlipH)]
    #[case::rotate_then_mirror_top_bottom(&[(b"irot", &[1u8][..]), (b"imir", &[0u8][..])], Orientation::Rotate90FlipH)]
    fn orientation_composes_irot_and_imir(
        #[case] transforms: &[(&[u8; 4], &[u8])],
        #[case] expected: Orientation,
    ) {
        assert_eq!(
            orientation(&transformed_avif(transforms)).unwrap(),
            expected
        );
    }

    #[test]
    fn an_encoder_written_avif_has_no_transforms() {
        assert_eq!(orientation(&avif()).unwrap(), Orientation::NoTransforms);
    }
}
