use std::{fmt::Display, str::FromStr};

use log::LevelFilter;
use serde_json::Value;

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

impl From<Value> for LogSettings {
    fn from(value: Value) -> Self {
        let level = value
            .get("level")
            .and_then(|value| value.as_str())
            .unwrap_or("Info");
        let level = LevelFilter::from_str(level).unwrap_or(LevelFilter::Info);

        Self { level }
    }
}

impl Display for LogSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "LogSettings {{ level: {} }}", self.level)
    }
}
