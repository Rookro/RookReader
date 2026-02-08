use serde_json::Value;

use crate::error;

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

impl TryFrom<Value> for HistorySettings {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(enable) = value.get("enable") else {
            return Err(error::Error::Settings(
                "Invalid hostory.enable.".to_string(),
            ));
        };
        let Some(enable) = enable.as_bool() else {
            return Err(error::Error::Settings(
                "Invalid hostory.enable.".to_string(),
            ));
        };

        let Some(restore_last_container_on_startup) =
            value.get("restore_last_container_on_startup")
        else {
            return Err(error::Error::Settings(
                "Invalid hostory.restore_last_container_on_startup.".to_string(),
            ));
        };
        let Some(restore_last_container_on_startup) = restore_last_container_on_startup.as_bool()
        else {
            return Err(error::Error::Settings(
                "Invalid hostory.restore_last_container_on_startup.".to_string(),
            ));
        };

        Ok(Self {
            enable,
            restore_last_container_on_startup,
        })
    }
}
