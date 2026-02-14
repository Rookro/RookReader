use std::{fmt::Display, str::FromStr};

use serde_json::Value;
use strum_macros::EnumString;

/// Represents the available UI themes for the application.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum AppTheme {
    /// The application theme will follow the system's theme (light or dark).
    System,
    /// The application will use a light theme.
    Light,
    /// The application will use a dark theme.
    Dark,
}

impl Default for AppTheme {
    fn default() -> Self {
        Self::System
    }
}

impl From<Value> for AppTheme {
    fn from(value: Value) -> Self {
        match value.as_str() {
            Some(value_str) => Self::from_str(value_str).unwrap_or_default(),
            None => Self::default(),
        }
    }
}

impl Display for AppTheme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::System => write!(f, "System"),
            Self::Light => write!(f, "Light"),
            Self::Dark => write!(f, "Dark"),
        }
    }
}
