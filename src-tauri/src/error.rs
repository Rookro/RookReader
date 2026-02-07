use serde::{Serialize, Serializer};
use thiserror::Error;

use crate::container::container::ContainerError;

/// General error information for the application.
#[derive(Debug, Error)]
pub enum Error {
    /// Container related errors.
    #[error("Container Error: {0}")]
    Container(#[from] ContainerError),
    /// IO related errors.
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
    /// Tauri related errors.
    #[error("Tauri Error: {0}")]
    Tauri(#[from] tauri::Error),
    /// Tauri store plugin related errors.
    #[error("Tauri Store Plugin Error: {0}")]
    TauriStorePlugin(#[from] tauri_plugin_store::Error),
    /// Serde related errors.
    #[error("Serde Error: {0}")]
    Serde(#[from] serde_json::Error),
    /// Strum related errors.
    #[error("Strum Error: {0}")]
    Strum(#[from] strum::ParseError),
    /// Settings related errors.
    #[error("Settings Error: {0}")]
    Settings(String),
    /// Mutex related errors.
    #[error("Mutex Error: {0}")]
    Mutex(String),
    /// Path related errors.
    #[error("Path Error: {0}")]
    Path(String),
    /// Other errors.
    #[error("Error: {0}")]
    Other(String),
}

impl From<String> for Error {
    fn from(message: String) -> Self {
        Error::Other(message)
    }
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// A specialized Result type for the application.
pub type Result<T> = std::result::Result<T, Error>;
