use serde_json::Value;

use crate::error;

/// Represents the settings for the novel reader.
#[allow(dead_code)]
pub struct NovelReaderSettings {
    /// The font family.
    pub font: String,
    /// The font size.
    pub font_size: f64,
}

#[allow(dead_code)]
impl NovelReaderSettings {
    /// Creates a new instance of NovelReaderSettings.
    ///
    /// # Arguments
    ///
    /// * `font` - The font family.
    /// * `font_size` - The font size.
    ///
    /// # Returns
    ///
    /// A new instance of NovelReaderSettings.
    pub fn new(font: String, font_size: f64) -> Self {
        Self { font, font_size }
    }
}

impl Default for NovelReaderSettings {
    fn default() -> Self {
        Self {
            font: "default-font".to_string(),
            font_size: 16.0,
        }
    }
}

impl TryFrom<Value> for NovelReaderSettings {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(font) = value.get("font") else {
            return Err(error::Error::Settings(
                "Invalid novel-reader.font.".to_string(),
            ));
        };
        let Some(font) = font.as_str() else {
            return Err(error::Error::Settings(
                "Invalid novel-reader.font.".to_string(),
            ));
        };

        let Some(font_size) = value.get("font_size") else {
            return Err(error::Error::Settings(
                "Invalid novel-reader.font_size.".to_string(),
            ));
        };
        let Some(font_size) = font_size.as_f64() else {
            return Err(error::Error::Settings(
                "Invalid novel-reader.font_size.".to_string(),
            ));
        };

        Ok(Self {
            font: font.to_string(),
            font_size,
        })
    }
}
