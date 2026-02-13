use std::{fmt::Display, str::FromStr};

use log::LevelFilter;
use serde_json::Value;

use crate::error;

/// Represents the settings for logging.
#[allow(dead_code)]
pub struct LogSettings {
    /// The log level.
    pub level: LevelFilter,
}

#[allow(dead_code)]
impl LogSettings {
    /// Creates a new instance of LogSettings.
    ///
    /// # Arguments
    ///
    /// * `level` - The log level.
    ///
    /// # Returns
    ///
    /// A new instance of LogSettings.
    pub fn new(level: LevelFilter) -> Self {
        Self { level }
    }
}

impl Default for LogSettings {
    fn default() -> Self {
        Self {
            level: LevelFilter::Info,
        }
    }
}

impl TryFrom<Value> for LogSettings {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(level) = value.get("level") else {
            return Err(error::Error::Settings("Invalid log.level.".to_string()));
        };
        let Some(level) = level.as_str() else {
            return Err(error::Error::Settings("Invalid log.level.".to_string()));
        };
        let Ok(level) = LevelFilter::from_str(level) else {
            return Err(error::Error::Settings("Invalid log.level.".to_string()));
        };

        Ok(Self { level })
    }
}

impl Display for LogSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "LogSettings {{ level: {} }}", self.level)
    }
}
