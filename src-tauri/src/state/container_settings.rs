use crate::image::resizer::ResizeFilter;

/// Represents settings for handling content within containers.
///
/// These settings control aspects like image rendering quality, resizing behavior,
/// and dependencies for specific file types like PDF.
#[derive(Clone)]
pub struct ContainerSettings {
    /// If `true`, enables the generation of low-resolution image previews for faster loading.
    pub enable_preview: bool,
    /// The maximum height in pixels for displayed images. Images exceeding this will be resized.
    /// A value of 0 implies no height limit.
    pub max_image_height: i32,
    /// The algorithm to use when resampling images (e.g., `ResizeFilter::Bilinear`).
    pub image_resampling_method: ResizeFilter,
    /// The target height in pixels when rendering a page from a PDF document as an image.
    pub pdf_render_resolution_height: i32,
    /// The maximum size of the image memory cache in MiB.
    pub image_cache_size_mib: u64,
    /// How many threads may read pages at once (`0` = pick one from the machine).
    /// Capped by the container's own `max_readers`.
    pub page_reader_count: i32,
    /// An optional path to the PDFium library, required for rendering PDF files.
    /// If `None`, the application may not be able to open PDF files.
    pub pdfium_library_path: Option<String>,
    /// If `true`, opening an archive descends through single sub-folders to the first
    /// level that holds pages.
    pub auto_descend_single_folder: bool,
}

impl Default for ContainerSettings {
    fn default() -> Self {
        ContainerSettings {
            enable_preview: true,
            max_image_height: 0,
            image_resampling_method: ResizeFilter::Bilinear,
            pdf_render_resolution_height: 2000,
            image_cache_size_mib: 1024,
            page_reader_count: 0,
            pdfium_library_path: None,
            auto_descend_single_folder: true,
        }
    }
}
