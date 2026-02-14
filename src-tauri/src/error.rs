use image::ImageError;
use pdfium_render::prelude::PdfiumError;
use rbook::ebook::errors::EbookError;
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
#[strum_discriminants(derive(Serialize))]
#[strum_discriminants(serde(rename_all = "camelCase"))]
#[allow(dead_code)]
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
    /// An error originating from the `unrar` library.
    #[error("Unrar Error: {0}")]
    Unrar(#[from] UnrarError),
    /// An error originating from the `zip` crate.
    #[error("Zip Error: {0}")]
    Zip(#[from] ZipError),
    /// An error originating from the `rbook` (EPUB) library.
    #[error("Epub Error: {0}")]
    Epub(#[from] EbookError),

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
    /// An error from the `tauri-plugin-store` plugin.
    #[error("Tauri Store Plugin Error: {0}")]
    TauriStorePlugin(#[from] tauri_plugin_store::Error),

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

    // 6xxxx: Application Logic & State
    /// An error indicating a failure to lock a Mutex.
    #[error("Mutex Error: {0}")]
    Mutex(String),

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
            ErrorCode::Image => 10201,
            ErrorCode::Unrar => 10301,
            ErrorCode::Zip => 10401,
            ErrorCode::Epub => 10501,

            // 2xxxx: File System & I/O
            ErrorCode::Io => 20001,
            ErrorCode::Path => 20101,

            // 3xxxx: Application Framework
            ErrorCode::Tauri => 30001,
            ErrorCode::TauriStorePlugin => 30101,

            // 4xxxx: Data Serialization & Validation
            ErrorCode::SerdeJson => 40001,
            ErrorCode::StrumParse => 40101,
            ErrorCode::ParseInt => 40201,

            // 5xxxx: Application Settings
            ErrorCode::Settings => 50001,

            // 6xxxx: Application Logic & State
            ErrorCode::Mutex => 60001,

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
        let mut state = serializer.serialize_struct("Error", 2)?;
        let error_code: ErrorCode = self.into();
        state.serialize_field("code", &error_code.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

/// A specialized `Result` type for the application, using the custom `Error` enum.
pub type Result<T> = std::result::Result<T, Error>;
