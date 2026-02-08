use serde_json::Value;

use crate::error;

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

impl TryFrom<Value> for ExperimentalFeaturesSettings {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(enable_epub_novel_reader) = value.get("enable-epub-novel-reader") else {
            return Err(error::Error::Settings(
                "Invalid enable-epub-novel-reader".to_string(),
            ));
        };
        let Some(enable_epub_novel_reader) = enable_epub_novel_reader.as_bool() else {
            return Err(error::Error::Settings(
                "Invalid enable-epub-novel-reader".to_string(),
            ));
        };
        Ok(Self {
            enable_epub_novel_reader,
        })
    }
}
