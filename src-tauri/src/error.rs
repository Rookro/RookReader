use fast_image_resize::ResizeError;
use image::ImageError;
use pdfium_render::prelude::PdfiumError;
use rbook::ebook::errors::{ArchiveError, EbookError};
use serde::{ser::SerializeStruct, Serialize, Serializer};
use std::num::ParseIntError;
use strum_macros::EnumDiscriminants;
use thiserror::Error;
use unrar::error::UnrarError;
use zip::result::ZipError;

/// The primary error type for all fallible operations in the application.
///
/// This enum consolidates errors from various sources, including I/O,
/// external libraries, and application-specific logic, into a single,
/// consistent error handling mechanism.
#[derive(Debug, Error, EnumDiscriminants)]
#[strum_discriminants(name(ErrorCode))]
#[strum_discriminants(derive(Serialize, strum_macros::EnumIter, strum_macros::IntoStaticStr))]
#[strum_discriminants(serde(rename_all = "camelCase"))]
#[strum_discriminants(strum(serialize_all = "camelCase"))]
pub enum Error {
    // 1xxxx: Container Processing
    /// An error for unsupported container formats (e.g., trying to open a .txt file).
    #[error("Unsupported Container Error: {0}")]
    UnsupportedContainer(String),
    /// An error for when a specific entry (e.g., an image file) is not found within a container.
    #[error("Entry Not Found Error: {0}")]
    EntryNotFound(String),
    /// An error originating from the `pdfium_render` library.
    #[error("PDFium Error: {0}")]
    Pdfium(#[from] PdfiumError),
    /// An error originating from the `image` crate.
    #[error("Image Error: {0}")]
    Image(#[from] ImageError),
    /// An error originating from the `fast_image_resize` crate.
    #[error("Image Resize Error: {0}")]
    ImageResize(#[from] ResizeError),
    /// An error originating from the `unrar` library.
    #[error("Unrar Error: {0}")]
    Unrar(#[from] UnrarError),
    /// An error originating from the `zip` crate.
    #[error("Zip Error: {0}")]
    Zip(#[from] ZipError),
    /// An error originating from the `rbook` (EPUB) library.
    #[error("Epub Error: {0}")]
    Epub(#[from] EbookError),
    #[error("Epub Archive Error: {0}")]
    /// An error originating from the `rbook` (EPUB archive) library.
    EpubArchive(#[from] ArchiveError),

    // 2xxxx: File System & I/O
    /// An error originating from standard library I/O operations.
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
    /// An error related to file paths (e.g., invalid format).
    #[error("Path Error: {0}")]
    Path(String),

    // 3xxxx: Application Framework
    /// An error originating from the Tauri framework itself.
    #[error("Tauri Error: {0}")]
    Tauri(#[from] tauri::Error),
    /// An error initializing the Rayon thread pool.
    #[error("Rayon Thread Pool Error: {0}")]
    RayonThreadPool(#[from] rayon::ThreadPoolBuildError),

    // 4xxxx: Data Serialization & Validation
    /// An error from the `serde_json` library during serialization or deserialization.
    #[error("Serde JSON Error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    /// An error during the parsing of a string into a strum-generated enum.
    #[error("Strum Parse Error: {0}")]
    StrumParse(#[from] strum::ParseError),
    /// An error when parsing a string into an integer type.
    #[error("Parse Int Error: {0}")]
    ParseInt(#[from] ParseIntError),

    // 5xxxx: Application Settings
    /// An error related to application settings.
    #[error("Settings Error: {0}")]
    Settings(String),
    /// One or more settings fields failed structured validation.
    ///
    /// Unlike [`Error::Settings`], this carries machine-readable per-field details
    /// (path, kind, and valid bounds) in the serialized error's `details` array so the
    /// frontend can render a localized, field-specific message.
    #[error("Settings validation failed")]
    SettingsValidation(Vec<crate::settings::SettingsValidationViolation>),

    // 6xxxx: Application Logic & State

    // 7xxxx: Database
    /// An error related to database operations.
    #[error("Database Error: {0}")]
    Database(#[from] sqlx::Error),
    /// An error related to database migrations.
    #[error("Migration Error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    // 9xxxx: Unexpected Errors
    /// A general-purpose error for miscellaneous or unexpected issues.
    #[error("Error: {0}")]
    Other(String),
}

impl From<String> for Error {
    fn from(message: String) -> Self {
        Error::Other(message)
    }
}

/// A serializable representation of the `Error` enum variants, used for stable error codes.
impl ErrorCode {
    /// Maps each error variant to a unique, stable integer code.
    ///
    /// These codes are intended to be used for programmatic error handling on the client-side,
    /// providing a more robust alternative to string-based message parsing.
    pub fn code(&self) -> i32 {
        match self {
            // 1xxxx: Container Processing
            ErrorCode::UnsupportedContainer => 10001,
            ErrorCode::EntryNotFound => 10002,
            ErrorCode::Pdfium => 10101,
            ErrorCode::Unrar => 10301,
            ErrorCode::Zip => 10401,
            ErrorCode::Epub => 10501,
            ErrorCode::EpubArchive => 10502,

            // 2xxxx: File System & I/O
            ErrorCode::Io => 20001,
            ErrorCode::Path => 20101,

            // 3xxxx: Application Framework
            ErrorCode::Tauri => 30001,
            ErrorCode::RayonThreadPool => 30201,

            // 4xxxx: Data Serialization & Validation
            ErrorCode::SerdeJson => 40001,
            ErrorCode::StrumParse => 40101,
            ErrorCode::ParseInt => 40201,

            // 5xxxx: Application Settings
            ErrorCode::Settings => 50001,
            ErrorCode::SettingsValidation => 50002,

            // 6xxxx: Application Logic & State

            // 7xxxx: Database
            ErrorCode::Database => 70001,
            ErrorCode::Migration => 70101,

            // 8xxxx: Image Processing
            ErrorCode::Image => 80001,
            ErrorCode::ImageResize => 80101,

            // 9xxxx: Unexpected Errors
            ErrorCode::Other => 90001,
        }
    }
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let error_code: ErrorCode = self.into();
        match self {
            // Structured validation errors carry a third `details` field; every other
            // variant keeps the stable two-field `{ code, message }` shape.
            Error::SettingsValidation(violations) => {
                let mut state = serializer.serialize_struct("Error", 3)?;
                state.serialize_field("code", &error_code.code())?;
                state.serialize_field("message", &self.to_string())?;
                state.serialize_field("details", violations)?;
                state.end()
            }
            _ => {
                let mut state = serializer.serialize_struct("Error", 2)?;
                state.serialize_field("code", &error_code.code())?;
                state.serialize_field("message", &self.to_string())?;
                state.end()
            }
        }
    }
}

/// The serialized shape of [`Error`] exposed to the frontend (`{ code, message }`).
///
/// This mirrors the custom `Serialize` implementation above and exists solely to
/// provide a `specta::Type` definition for `Error`, since the `Error` enum itself
/// wraps foreign error types that cannot derive `specta::Type`. The exported TS type
/// takes this struct's name, `CommandError`.
#[derive(specta::Type)]
#[allow(dead_code)]
struct CommandError {
    /// The stable, programmatic error code.
    code: i32,
    /// The human-readable error message.
    message: String,
    /// Per-field validation details, present only for `SettingsValidation` errors.
    details: Option<Vec<crate::settings::SettingsValidationViolation>>,
}

impl specta::Type for Error {
    fn definition(types: &mut specta::Types) -> specta::datatype::DataType {
        CommandError::definition(types)
    }
}

/// A specialized `Result` type for the application, using the custom `Error` enum.
pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{SettingsValidationViolation, ViolationKind};

    #[test]
    fn error_codes_are_unique() {
        use strum::IntoEnumIterator;
        let mut seen = std::collections::HashSet::new();
        for variant in ErrorCode::iter() {
            assert!(
                seen.insert(variant.code()),
                "duplicate code {}",
                variant.code()
            );
        }
    }

    #[test]
    fn serializes_generic_error_as_code_and_message() {
        let value = serde_json::to_value(Error::Settings("boom".to_string())).unwrap();
        assert_eq!(value["code"], 50001);
        assert_eq!(value["message"], "Settings Error: boom");
        // No `details` for non-validation errors.
        assert!(value.get("details").is_none());
    }

    #[test]
    fn serializes_settings_validation_with_details() {
        let err = Error::SettingsValidation(vec![SettingsValidationViolation {
            path: "reader.rendering.maxImageHeight".to_string(),
            kind: ViolationKind::OutOfRange,
            min: 0.0,
            max: 65535.0,
        }]);
        let value = serde_json::to_value(err).unwrap();

        assert_eq!(value["code"], 50002);
        assert_eq!(value["message"], "Settings validation failed");
        let details = value["details"].as_array().expect("details array");
        assert_eq!(details.len(), 1);
        assert_eq!(details[0]["path"], "reader.rendering.maxImageHeight");
        assert_eq!(details[0]["kind"], "outOfRange");
        assert_eq!(details[0]["min"], 0.0);
        assert_eq!(details[0]["max"], 65535.0);
    }
}
