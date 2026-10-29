use crate::image::resizer::ResizeFilter;
use crate::settings::AppSettings;

/// Represents settings for handling content within containers.
///
/// These settings control aspects like image rendering quality, resizing behavior,
/// and dependencies for specific file types like PDF.
#[derive(Clone)]
pub struct ContainerSettings {
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

impl From<&AppSettings> for ContainerSettings {
    /// Copies the reader values from the app settings. The PDFium path is not a setting, so
    /// it starts as `None`.
    fn from(settings: &AppSettings) -> Self {
        let reader = &settings.reader;
        ContainerSettings {
            max_image_height: reader.rendering.max_image_height,
            image_resampling_method: reader.rendering.image_resampling_method.into(),
            pdf_render_resolution_height: reader.rendering.pdf_render_resolution_height,
            image_cache_size_mib: reader.comic.cache.image_cache_size_mib,
            page_reader_count: reader.comic.cache.page_reader_count,
            pdfium_library_path: None,
            auto_descend_single_folder: reader.auto_descend_single_folder,
        }
    }
}

impl Default for ContainerSettings {
    fn default() -> Self {
        Self::from(&AppSettings::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::ImageResamplingMethod;

    #[test]
    fn from_app_settings_copies_the_reader_values() {
        let mut settings = AppSettings::default();
        settings.reader.rendering.max_image_height = 1234;
        settings.reader.rendering.image_resampling_method = ImageResamplingMethod::Nearest;
        settings.reader.rendering.pdf_render_resolution_height = 1500;
        settings.reader.comic.cache.image_cache_size_mib = 2048;
        settings.reader.comic.cache.page_reader_count = 3;
        settings.reader.auto_descend_single_folder = false;

        let container_settings = ContainerSettings::from(&settings);

        assert_eq!(container_settings.max_image_height, 1234);
        assert_eq!(
            container_settings.image_resampling_method,
            ResizeFilter::Nearest
        );
        assert_eq!(container_settings.pdf_render_resolution_height, 1500);
        assert_eq!(container_settings.image_cache_size_mib, 2048);
        assert_eq!(container_settings.page_reader_count, 3);
        assert!(!container_settings.auto_descend_single_folder);
        assert_eq!(container_settings.pdfium_library_path, None);
    }
}
