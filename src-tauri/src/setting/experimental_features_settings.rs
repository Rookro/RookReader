use std::fmt::Display;

use serde_json::Value;

/// Represents settings for experimental, potentially unstable features.
pub struct ExperimentalFeaturesSettings {
    /// If `true`, enables the experimental reader for EPUB-based novels.
    pub enable_epub_novel_reader: bool,
}

impl ExperimentalFeaturesSettings {
    /// Create a new instance of `ExperimentalFeaturesSettings`.
    ///
    /// # Arguments
    ///
    /// * `enable_epub_novel_reader` - Set to `true` to enable the EPUB novel reader.
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
        Self::new(false)
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
