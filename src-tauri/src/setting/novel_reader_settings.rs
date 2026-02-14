use std::fmt::Display;

use serde_json::Value;

/// Represents the settings specifically for the novel reader view.
pub struct NovelReaderSettings {
    /// The font family to be used for rendering novel text.
    pub font: String,
    /// The font size in pixels.
    pub font_size: f64,
}

impl NovelReaderSettings {
    /// Creates a new instance of `NovelReaderSettings`.
    ///
    /// # Arguments
    ///
    /// * `font` - The font family name.
    /// * `font_size` - The size of the font in pixels.
    ///
    /// # Returns
    ///
    /// A new instance of `NovelReaderSettings`.
    pub fn new(font: String, font_size: f64) -> Self {
        Self { font, font_size }
    }
}

impl Default for NovelReaderSettings {
    fn default() -> Self {
        Self::new("default-font".to_string(), 16.0)
    }
}

impl From<Value> for NovelReaderSettings {
    fn from(value: Value) -> Self {
        let font = value
            .get("font")
            .and_then(|value| value.as_str())
            .unwrap_or("default-font");

        let font_size = value
            .get("font-size")
            .and_then(|value| value.as_f64())
            .unwrap_or(16.0);

        Self {
            font: font.to_string(),
            font_size,
        }
    }
}

impl Display for NovelReaderSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "NovelReaderSettings {{ font: {}, font-size: {} }}",
            self.font, self.font_size
        )
    }
}
