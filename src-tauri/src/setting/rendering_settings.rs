use std::fmt::Display;

use serde_json::Value;

/// Rendering settings.
pub struct RenderingSettings {
    /// Enable preview.
    pub enable_preview: bool,
    /// Maximum image height.
    pub max_image_height: i32,
    /// Image resize method.
    pub image_resize_method: String,
    /// PDF rendering height.
    pub pdf_rendering_height: i32,
}

impl RenderingSettings {
    pub fn new(
        enable_preview: bool,
        max_image_height: i32,
        image_resize_method: String,
        pdf_rendering_height: i32,
    ) -> Self {
        Self {
            enable_preview,
            max_image_height,
            image_resize_method,
            pdf_rendering_height,
        }
    }
}

impl Default for RenderingSettings {
    fn default() -> Self {
        Self::new(true, 0, "triangle".to_string(), 2000)
    }
}

impl From<Value> for RenderingSettings {
    fn from(value: Value) -> Self {
        let enable_preview = value
            .get("enable-preview")
            .and_then(|value| value.as_bool())
            .unwrap_or(true);
        let max_image_height = value
            .get("max-image-height")
            .and_then(|value| value.as_i64())
            .unwrap_or(0) as i32;
        let image_resize_method = value
            .get("image-resize-method")
            .and_then(|value| value.as_str())
            .unwrap_or("triangle")
            .to_string();
        let pdf_rendering_height = value
            .get("pdf-rendering-height")
            .and_then(|value| value.as_i64())
            .unwrap_or(2000) as i32;

        Self::new(
            enable_preview,
            max_image_height,
            image_resize_method,
            pdf_rendering_height,
        )
    }
}

impl Display for RenderingSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "RenderingSettings {{ Enable Preview: {}, Max Image Height: {}, Image Resize Method: {}, PDF Rendering Height: {} }}",
            self.enable_preview, self.max_image_height, self.image_resize_method, self.pdf_rendering_height
        )
    }
}
