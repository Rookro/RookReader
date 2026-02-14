use std::fmt::Display;

use serde_json::Value;

/// Represents settings related to content rendering, primarily for images.
pub struct RenderingSettings {
    /// If `true`, enables the generation of low-resolution image previews for faster loading.
    pub enable_preview: bool,
    /// The maximum height in pixels for displayed images. Images exceeding this will be resized.
    /// A value of 0 implies no height limit.
    pub max_image_height: i32,
    /// The algorithm to use when resizing images (e.g., "triangle", "lanczos3").
    pub image_resize_method: String,
    /// The target height in pixels when rendering a page from a PDF document as an image.
    pub pdf_rendering_height: i32,
}

impl RenderingSettings {
    /// Creates a new instance of `RenderingSettings`.
    ///
    /// # Arguments
    ///
    /// * `enable_preview` - Whether to enable image previews.
    /// * `max_image_height` - The maximum height for images.
    /// * `image_resize_method` - The resizing algorithm to use.
    /// * `pdf_rendering_height` - The rendering height for PDF pages.
    ///
    /// # Returns
    ///
    /// A new instance of `RenderingSettings`.
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
