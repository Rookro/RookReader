use std::fmt::Display;

use serde_json::Value;

/// Represents the settings for experimental features.
#[allow(dead_code)]
pub struct ExperimentalFeaturesSettings {
    /// Whether to enable the epub novel reader.
    pub enable_epub_novel_reader: bool,
}

#[allow(dead_code)]
impl ExperimentalFeaturesSettings {
    /// Create a new instance of `ExperimentalFeaturesSettings`.
    ///
    /// # Arguments
    ///
    /// * `enable_epub_novel_reader` - Whether to enable the epub novel reader.
    ///
    /// # Returns
    ///
    /// A new instance of `ExperimentalFeaturesSettings`.
    pub fn new(enable_epub_novel_reader: bool) -> Self {
        Self {
            enable_epub_novel_reader,
        }
    }
}

impl Default for ExperimentalFeaturesSettings {
    fn default() -> Self {
        Self {
            enable_epub_novel_reader: false,
        }
    }
}

impl From<Value> for ExperimentalFeaturesSettings {
    fn from(value: Value) -> Self {
        let enable_epub_novel_reader = value
            .get("enable-epub-novel-reader")
            .and_then(|value| value.as_bool())
            .unwrap_or(false);

        Self {
            enable_epub_novel_reader,
        }
    }
}

impl Display for ExperimentalFeaturesSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "ExperimentalFeaturesSettings {{ enable-epub-novel-reader: {} }}",
            self.enable_epub_novel_reader
        )
    }
}
