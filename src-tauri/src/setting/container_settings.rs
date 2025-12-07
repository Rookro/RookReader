/// Archive container settings.
pub struct ContainerSettings {
    /// PDF rendering height(px).
    pub pdf_rendering_height: i32,
    /// The path to the pdfium library.
    pub pdfium_library_path: Option<String>,
}

impl Default for ContainerSettings {
    fn default() -> Self {
        ContainerSettings {
            pdf_rendering_height: 2000,
            pdfium_library_path: None,
        }
    }
}
