use image::imageops::FilterType;

/// Represents settings for handling content within containers.
///
/// These settings control aspects like image rendering quality, resizing behavior,
/// and dependencies for specific file types like PDF.
pub struct ContainerSettings {
    /// If `true`, enables the generation of low-resolution image previews for faster loading.
    pub enable_preview: bool,
    /// The maximum height in pixels for displayed images. Images exceeding this will be resized.
    /// A value of 0 implies no height limit.
    pub max_image_height: i32,
    /// The algorithm to use when resizing images (e.g., `FilterType::Triangle`).
    pub image_resize_method: FilterType,
    /// The target height in pixels when rendering a page from a PDF document as an image.
    pub pdf_rendering_height: i32,
    /// An optional path to the PDFium library, required for rendering PDF files.
    /// If `None`, the application may not be able to open PDF files.
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
