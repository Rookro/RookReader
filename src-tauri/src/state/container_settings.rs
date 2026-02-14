use image::imageops::FilterType;

/// Archive container settings.
pub struct ContainerSettings {
    /// Enable preview.
    pub enable_preview: bool,
    /// Maximum image height(px).
    pub max_image_height: i32,
    /// Image resize method.
    pub image_resize_method: FilterType,
    /// PDF rendering height(px).
    pub pdf_rendering_height: i32,
    /// The path to the pdfium library.
    pub pdfium_library_path: Option<String>,
}

impl Default for ContainerSettings {
    fn default() -> Self {
        ContainerSettings {
            enable_preview: true,
            max_image_height: 0,
            image_resize_method: FilterType::Triangle,
            pdf_rendering_height: 2000,
            pdfium_library_path: None,
        }
    }
}
