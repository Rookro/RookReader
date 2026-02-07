use std::str::FromStr;

use serde_json::Value;
use strum_macros::EnumString;

use crate::error;

/// AppTheme represents the themes available for the application.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum AppTheme {
    /// System theme.
    System,
    /// Light theme.
    Light,
    /// Dark theme.
    Dark,
}

impl TryFrom<Value> for AppTheme {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        match value.as_str() {
            Some(value_str) => AppTheme::from_str(value_str).map_err(|e| e.into()),
            None => Err(error::Error::Settings("Invalid app theme.".to_string())),
        }
    }
}
