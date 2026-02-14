use std::fmt::Display;

use serde_json::Value;

/// Represents the settings for history.
#[allow(dead_code)]
pub struct HistorySettings {
    /// Whether history is enabled.
    pub enable: bool,
    /// Whether to restore the last container on startup.
    pub restore_last_container_on_startup: bool,
}

#[allow(dead_code)]
impl HistorySettings {
    /// Creates a new instance of HistorySettings.
    ///
    /// # Arguments
    ///
    /// * `enable` - Whether history is enabled.
    /// * `restore_last_container_on_startup` - Whether to restore the last container on startup.
    ///
    /// # Returns
    ///
    /// A new instance of HistorySettings.
    pub fn new(enable: bool, restore_last_container_on_startup: bool) -> Self {
        Self {
            enable,
            restore_last_container_on_startup,
        }
    }
}

impl Default for HistorySettings {
    fn default() -> Self {
        Self {
            enable: true,
            restore_last_container_on_startup: true,
        }
    }
}

impl From<Value> for HistorySettings {
    fn from(value: Value) -> Self {
        let enable = value
            .get("enable")
            .and_then(|value| value.as_bool())
            .unwrap_or(true);

        let restore_last_container_on_startup = value
            .get("restore-last-container-on-startup")
            .and_then(|value| value.as_bool())
            .unwrap_or(true);

        Self {
            enable,
            restore_last_container_on_startup,
        }
    }
}

impl Display for HistorySettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "HistorySettings {{ enable: {}, restore_last_container_on_startup: {} }}",
            self.enable, self.restore_last_container_on_startup
        )
    }
}
