use serde_json::Value;

use super::{SettingsValidationViolation, ViolationKind};

/// The authoritative numeric bound for one settings leaf, used to produce structured
/// validation violations.
struct FieldBound {
    /// camelCase dotted path into the serialized settings document.
    path: &'static str,
    /// Whether the field must be a whole number (mirrors the Rust field's integer type).
    integer: bool,
    /// Inclusive minimum (mirrors `#[garde(range(min = ...))]`).
    min: f64,
    /// Inclusive maximum (mirrors `#[garde(range(max = ...))]`).
    max: f64,
}

/// Numeric bounds for every range-validated settings leaf.
///
/// These literals mirror the `#[garde(range(...))]` attributes on the structs in
/// [`super::model`]. The duplication is intentional and confined to this file;
/// `test_bounds_table_agrees_with_garde` cross-checks every entry against the derived
/// `garde` validator so the two cannot drift.
const FIELD_BOUNDS: &[FieldBound] = &[
    FieldBound {
        path: "bookshelf.gridSize",
        integer: true,
        min: 0.0,
        max: 2.0,
    },
    FieldBound {
        path: "reader.comic.cache.preloadPageCount",
        integer: true,
        min: 0.0,
        max: 10000.0,
    },
    FieldBound {
        path: "reader.comic.cache.imageCacheSizeMib",
        integer: true,
        min: 1.0,
        max: 65536.0,
    },
    FieldBound {
        path: "reader.comic.loupe.zoom",
        integer: false,
        min: 1.0,
        max: 100.0,
    },
    FieldBound {
        path: "reader.comic.loupe.radius",
        integer: false,
        min: 50.0,
        max: 5000.0,
    },
    FieldBound {
        path: "reader.novel.fontSize",
        integer: false,
        min: 1.0,
        max: 200.0,
    },
    FieldBound {
        path: "reader.rendering.maxImageHeight",
        integer: true,
        min: 0.0,
        max: 65535.0,
    },
    FieldBound {
        path: "reader.rendering.pdfRenderResolutionHeight",
        integer: true,
        min: 1.0,
        max: 20000.0,
    },
    FieldBound {
        path: "layout.sidePane.tabIndex",
        integer: true,
        min: 0.0,
        max: 100.0,
    },
];

/// Collects structured validation violations from a merged settings JSON document.
///
/// Runs over [`FIELD_BOUNDS`] **before** `serde` deserialization, so a decimal typed
/// into an integer field becomes a `NotInteger` violation carrying the field path —
/// rather than an opaque `serde` error with no path. Leaves absent from the document
/// are skipped (the merge base always supplies them, but this stays robust regardless).
/// `garde` remains the authoritative gate; this only enriches the error for the UI.
///
/// # Arguments
///
/// * `merged_json` - The settings document after the patch has been deep-merged in.
///
/// # Returns
///
/// One violation per out-of-bounds field, in [`FIELD_BOUNDS`] order (empty when valid).
pub(super) fn collect_violations(merged_json: &Value) -> Vec<SettingsValidationViolation> {
    let mut violations = Vec::new();
    for bound in FIELD_BOUNDS {
        let segments: Vec<String> = bound.path.split('.').map(str::to_string).collect();
        let Some(value) = json_leaf(merged_json, &segments) else {
            continue;
        };
        let kind = match value.as_f64() {
            None => Some(ViolationKind::NotANumber),
            Some(n) if !n.is_finite() => Some(ViolationKind::NotANumber),
            Some(n) if bound.integer && n.fract() != 0.0 => Some(ViolationKind::NotInteger),
            Some(n) if n < bound.min || n > bound.max => Some(ViolationKind::OutOfRange),
            Some(_) => None,
        };
        if let Some(kind) = kind {
            violations.push(SettingsValidationViolation {
                path: bound.path.to_string(),
                kind,
                min: bound.min,
                max: bound.max,
            });
        }
    }
    violations
}

/// `garde` custom validator rejecting non-finite floats.
///
/// `garde`'s `range` validator does not reject `NaN` (all comparisons against `NaN`
/// are false, so it passes the min/max check), so this guard is paired with `range`
/// on every float field to keep `NaN`/infinity out of the settings.
pub(super) fn finite_f64(value: &f64, _ctx: &()) -> garde::Result {
    if value.is_finite() {
        Ok(())
    } else {
        Err(garde::Error::new("must be a finite number"))
    }
}

/// Converts a snake_case segment to camelCase.
///
/// `garde` reports Rust field names (snake_case) while the serialized document uses
/// serde camelCase, so report paths must be translated before navigating the JSON.
pub(super) fn snake_to_camel_case(segment: &str) -> String {
    let mut out = String::with_capacity(segment.len());
    let mut up = false;
    for c in segment.chars() {
        if c == '_' {
            up = true;
        } else if up {
            out.extend(c.to_uppercase());
            up = false;
        } else {
            out.push(c);
        }
    }
    out
}

/// Navigates `value` along `segments`, returning the addressed leaf if present.
pub(super) fn json_leaf<'a>(value: &'a Value, segments: &[String]) -> Option<&'a Value> {
    let mut cur = value;
    for s in segments {
        cur = cur.get(s.as_str())?;
    }
    Some(cur)
}

/// Replaces the leaf addressed by `segments` in `value` with `new_value`.
///
/// Returns `true` if the leaf existed and was replaced, `false` otherwise.
pub(super) fn set_json_leaf(value: &mut Value, segments: &[String], new_value: Value) -> bool {
    let Some((last, parents)) = segments.split_last() else {
        return false;
    };
    let mut cur = value;
    for s in parents {
        let Some(next) = cur.get_mut(s.as_str()) else {
            return false;
        };
        cur = next;
    }
    match cur.get_mut(last.as_str()) {
        Some(slot) => {
            *slot = new_value;
            true
        }
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::AppSettings;
    use garde::Validate;
    use serde_json::json;
    use std::path::PathBuf;

    /// A full, valid document with a non-empty home directory, so it passes validation
    /// unchanged (a stable baseline the violation tests mutate one field at a time).
    fn default_doc_with_home() -> Value {
        let mut settings = AppSettings::default();
        settings.file_navigator.home_directory = PathBuf::from("/mock/home");
        serde_json::to_value(&settings).unwrap()
    }

    #[test]
    fn test_collect_violations_valid_doc_is_empty() {
        assert!(collect_violations(&default_doc_with_home()).is_empty());
    }

    #[test]
    fn test_collect_violations_out_of_range_high_and_low() {
        let mut doc = default_doc_with_home();
        doc["reader"]["rendering"]["maxImageHeight"] = json!(70000);
        doc["reader"]["comic"]["loupe"]["zoom"] = json!(0.5);
        let violations = collect_violations(&doc);

        let max_height = violations
            .iter()
            .find(|v| v.path == "reader.rendering.maxImageHeight")
            .expect("maxImageHeight violation");
        assert_eq!(max_height.kind, ViolationKind::OutOfRange);
        assert_eq!(max_height.min, 0.0);
        assert_eq!(max_height.max, 65535.0);

        let zoom = violations
            .iter()
            .find(|v| v.path == "reader.comic.loupe.zoom")
            .expect("zoom violation");
        assert_eq!(zoom.kind, ViolationKind::OutOfRange);
        assert_eq!(zoom.min, 1.0);
        assert_eq!(zoom.max, 100.0);
    }

    #[test]
    fn test_collect_violations_decimal_in_integer_field_is_not_integer() {
        let mut doc = default_doc_with_home();
        doc["reader"]["rendering"]["maxImageHeight"] = json!(100.5);
        let violations = collect_violations(&doc);

        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].path, "reader.rendering.maxImageHeight");
        assert_eq!(violations[0].kind, ViolationKind::NotInteger);
    }

    #[test]
    fn test_collect_violations_non_number_is_not_a_number() {
        let mut doc = default_doc_with_home();
        doc["reader"]["novel"]["fontSize"] = json!("16");
        let violations = collect_violations(&doc);

        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].path, "reader.novel.fontSize");
        assert_eq!(violations[0].kind, ViolationKind::NotANumber);
    }

    #[test]
    fn test_collect_violations_accepts_in_range_decimal_font_size() {
        let mut doc = default_doc_with_home();
        // A fractional value is valid for the f64 fontSize field.
        doc["reader"]["novel"]["fontSize"] = json!(16.5);
        assert!(collect_violations(&doc).is_empty());
    }

    #[test]
    fn test_bounds_table_agrees_with_garde() {
        // Every bounds-table entry must mirror the authoritative validation: the boundary
        // values pass and just-outside values are rejected. This is the drift guard that
        // justifies the literal duplication in `FIELD_BOUNDS`. "Rejected" combines serde
        // and garde, because unsigned/integer types reject out-of-range at deserialization
        // (e.g. `-1` into a `u8`) while garde catches the rest.
        let epsilon = 0.000_001;

        // Builds a JSON number appropriate for the field (integer fields get integer JSON
        // so they deserialize; decimals keep the fractional value).
        let to_json = |bound: &FieldBound, value: f64| {
            if bound.integer {
                json!(value.round() as i64)
            } else {
                json!(value)
            }
        };
        // The settings is rejected when it fails to deserialize OR fails garde validation.
        let is_rejected = |doc: Value| match serde_json::from_value::<AppSettings>(doc) {
            Ok(settings) => settings.validate().is_err(),
            Err(_) => true,
        };

        for bound in FIELD_BOUNDS {
            let segments: Vec<String> = bound.path.split('.').map(str::to_string).collect();

            for &value in &[bound.min, bound.max] {
                let mut doc = default_doc_with_home();
                assert!(
                    set_json_leaf(&mut doc, &segments, to_json(bound, value)),
                    "could not set `{}` in document",
                    bound.path
                );
                assert!(
                    !is_rejected(doc),
                    "validation rejected boundary value {value} for `{}`",
                    bound.path
                );
            }

            let just_below = if bound.integer {
                bound.min - 1.0
            } else {
                bound.min - epsilon
            };
            let just_above = if bound.integer {
                bound.max + 1.0
            } else {
                bound.max + epsilon
            };
            for &value in &[just_below, just_above] {
                let mut doc = default_doc_with_home();
                assert!(set_json_leaf(&mut doc, &segments, to_json(bound, value)));
                assert!(
                    is_rejected(doc),
                    "validation accepted out-of-range value {value} for `{}`",
                    bound.path
                );
            }
        }
    }

    #[test]
    fn test_snake_to_camel_case() {
        assert_eq!(snake_to_camel_case("max_image_height"), "maxImageHeight");
        assert_eq!(snake_to_camel_case("zoom"), "zoom");
        assert_eq!(
            snake_to_camel_case("pdf_render_resolution_height"),
            "pdfRenderResolutionHeight"
        );
    }
}
