use image::ImageError;
use pdfium_render::prelude::PdfiumError;
use rbook::ebook::errors::EbookError;
use serde::{ser::SerializeStruct, Serialize, Serializer};
use std::num::ParseIntError;
use strum_macros::EnumDiscriminants;
use thiserror::Error;
use unrar::error::UnrarError;
use zip::result::ZipError;

/// General error information for the application.
#[derive(Debug, Error, EnumDiscriminants)]
#[strum_discriminants(name(ErrorCode))]
#[strum_discriminants(derive(Serialize))]
#[strum_discriminants(serde(rename_all = "camelCase"))]
pub enum Error {
    // 1xxxx: Container Processing
    #[error("Unsupported Container Error: {0}")]
    UnsupportedContainer(String),
    #[error("Entry Not Found Error: {0}")]
    EntryNotFound(String),
    #[error("PDFium Error: {0}")]
    Pdfium(#[from] PdfiumError),
    #[error("Image Error: {0}")]
    Image(#[from] ImageError),
    #[error("Unrar Error: {0}")]
    Unrar(#[from] UnrarError),
    #[error("Zip Error: {0}")]
    Zip(#[from] ZipError),
    #[error("Epub Error: {0}")]
    Epub(#[from] EbookError),

    // 2xxxx: File System & I/O
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Path Error: {0}")]
    Path(String),

    // 3xxxx: Application Framework
    #[error("Tauri Error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("Tauri Store Plugin Error: {0}")]
    TauriStorePlugin(#[from] tauri_plugin_store::Error),

    // 4xxxx: Data Serialization & Validation
    #[error("Serde JSON Error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("Strum Parse Error: {0}")]
    StrumParse(#[from] strum::ParseError),
    #[error("Parse Int Error: {0}")]
    ParseInt(#[from] ParseIntError),

    // 5xxxx: Application Settings
    #[error("Settings Error: {0}")]
    Settings(String),

    // 6xxxx: Application Logic & State
    #[error("Mutex Error: {0}")]
    Mutex(String),

    // 9xxxx: Unexpected Errors
    #[error("Error: {0}")]
    Other(String),
}

impl From<String> for Error {
    fn from(message: String) -> Self {
        Error::Other(message)
    }
}

/// Error codes for the application.
impl ErrorCode {
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

/// A specialized Result type for the application.
pub type Result<T> = std::result::Result<T, Error>;
