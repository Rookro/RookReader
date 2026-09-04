use std::sync::Arc;

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::factory::{create_container, ContainerConfig},
    error::Result,
    page::{cache::Cache, pipeline::Pipeline, service::PageService},
    state::container_settings::ContainerSettings,
};

/// Builds an image cache whose total weight is capped at `size_mib` mebibytes.
///
/// Each entry's weight is its encoded byte length, so the cache evicts based on the
/// actual memory footprint of the stored images.
///
/// # Arguments
///
/// * `size_mib` - The maximum total cache capacity, in mebibytes.
///
/// # Returns
///
/// A new, empty `Cache` with the configured capacity and weigher.
fn build_image_cache(size_mib: u64) -> Cache {
    mini_moka::sync::Cache::builder()
        .max_capacity(size_mib * 1024 * 1024)
        .weigher(|_key, value: &Arc<crate::image::types::Image>| -> u32 {
            value.data.len().try_into().unwrap_or(u32::MAX)
        })
        .build()
}

/// The height pdfium is asked to render a PDF page at.
///
/// Never larger than the page will be displayed. Formats that render their own pages used
/// to be exempted from the generic resize instead, which left pdfium producing a page the
/// pipeline then decoded and shrank again; this replaces that exemption, and pdfium
/// renders the right size to begin with.
///
/// # Arguments
///
/// * `settings` - The container settings to read the two heights from.
///
/// # Returns
///
/// The render height, capped by `max_image_height` unless that is 0 (no limit).
fn pdf_render_height(settings: &ContainerSettings) -> i32 {
    if settings.max_image_height > 0 {
        settings
            .pdf_render_resolution_height
            .min(settings.max_image_height)
    } else {
        settings.pdf_render_resolution_height
    }
}

/// Holds the state related to the currently open container (e.g., a file or directory).
pub struct ContainerState {
    /// A nested struct containing settings specific to container handling, like rendering quality.
    pub settings: ContainerSettings,
    /// The open book: its structure, its reader threads and its queue, in one handle.
    /// `None` if no container is open.
    ///
    /// Private because [`ContainerState::service_for`] is the only way to reach it, and
    /// that is the point: the book a request names has to be the book that is open.
    service: Option<Arc<PageService>>,
    /// Global image cache shared across all containers.
    pub image_cache: Cache,
}

impl Default for ContainerState {
    fn default() -> Self {
        let settings = ContainerSettings::default();
        let image_cache = build_image_cache(settings.image_cache_size_mib);

        Self {
            settings,
            service: None,
            image_cache,
        }
    }
}

impl ContainerState {
    /// The open book's service, or `None` when the book currently open is not `path`.
    ///
    /// Entry names collide across archives — every book has an `0001.jpg` — so resolving
    /// one against the wrong book silently serves another book's page. Making this check
    /// the only way to reach the service is what keeps it from being forgotten at the
    /// next call site.
    ///
    /// # Arguments
    ///
    /// * `path` - The book the caller believes is open.
    pub fn service_for(&self, path: &str) -> Option<Arc<PageService>> {
        self.service
            .as_ref()
            .filter(|service| service.book_id() == path)
            .cloned()
    }

    /// Whether any book is open.
    ///
    /// Test-only on purpose: production code always asks about a *specific* book, through
    /// [`ContainerState::service_for`], because "some book is open" is never the question
    /// a request needs answered.
    #[cfg(test)]
    pub fn is_open(&self) -> bool {
        self.service.is_some()
    }

    /// Re-initializes the image cache with a new maximum capacity.
    ///
    /// This clears the existing cache and hands the new one to the open book's workers,
    /// which read it through the same handle they write through.
    pub fn update_image_cache_size(&mut self, size_mib: u64) {
        log::debug!("Updating image cache size to {} MiB", size_mib);
        self.image_cache = build_image_cache(size_mib);

        if let Some(service) = self.service.as_ref() {
            service.set_cache(self.image_cache.clone());
        }
    }

    /// Closes any open book and drops its service.
    pub fn clear(&mut self) {
        if let Some(service) = self.service.take() {
            // Explicitly, and before dropping: a caller blocked in `dimensions` holds an
            // `Arc` of its own, so the drop alone would leave the outgoing book's scan
            // running against the incoming book's reads.
            service.close();
        }
    }

    /// The container options these settings imply.
    ///
    /// Shared by every caller that opens a container, because the options decide what the
    /// container *is*: `auto_descend_single_folder` changes which folder inside an archive
    /// becomes the book, so a caller that guessed it would describe a different set of
    /// pages than the one the reader would see.
    ///
    /// # Arguments
    ///
    /// * `settings` - The container settings snapshot to derive the options from.
    ///
    /// # Returns
    ///
    /// The options to pass to [`create_container`].
    pub fn container_config(settings: &ContainerSettings) -> ContainerConfig {
        ContainerConfig {
            pdf_render_config: PdfRenderConfig::default()
                .set_target_height(pdf_render_height(settings)),
            pdfium_library_path: settings.pdfium_library_path.clone(),
            auto_descend_single_folder: settings.auto_descend_single_folder,
        }
    }

    /// Builds the page service from borrowed settings and a cache handle.
    ///
    /// This takes its inputs by reference rather than through `&self` so a caller can
    /// snapshot the (cheap-to-clone) settings and cache under a brief lock and then run
    /// this heavy I/O on a blocking thread without holding any lock on the shared state.
    ///
    /// The container is not returned beside the service: the service owns it, and holding
    /// the two next to each other is exactly what forces every caller to re-establish
    /// that they describe the same book.
    ///
    /// # Arguments
    ///
    /// * `settings` - The container settings snapshot to build with.
    /// * `image_cache` - The shared image cache handle.
    /// * `path` - The file system path to the container to build.
    ///
    /// # Returns
    ///
    /// The started `PageService` for the book on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the file extension is missing or unsupported, or the
    /// underlying constructor fails (e.g. file not found, corrupt file).
    pub fn build_with(
        settings: &ContainerSettings,
        image_cache: &Cache,
        path: &str,
    ) -> Result<PageService> {
        Ok(PageService::new(
            path.to_string(),
            create_container(path, Self::container_config(settings))?,
            Pipeline {
                max_image_height: settings.max_image_height as u32,
                resize_method: settings.image_resampling_method,
            },
            image_cache.clone(),
            settings.page_reader_count.max(0) as usize,
        ))
    }

    /// Installs a previously built service, closing and replacing any open one.
    ///
    /// # Arguments
    ///
    /// * `service` - The service to install.
    pub fn install(&mut self, service: PageService) {
        self.clear();
        self.service = Some(Arc::new(service));
    }
}

#[cfg(test)]
mod tests {
    use std::path;

    use super::*;

    pub fn get_pdfium_lib_path() -> String {
        let pdfium_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("dependencies")
            .join("pdfium");

        let lib_path = if pdfium_path.clone().join("bin").exists() {
            pdfium_path.clone().join("bin")
        } else {
            pdfium_path.clone().join("lib")
        };

        lib_path.to_string_lossy().to_string()
    }

    #[test]
    fn test_default_container_state() {
        let state = ContainerState::default();

        assert!(!state.is_open());
        assert_eq!(
            ContainerSettings::default().pdf_render_resolution_height,
            state.settings.pdf_render_resolution_height
        );
    }

    #[test]
    fn test_build_with_unsupported_extension() {
        let state = ContainerState::default();
        let result = ContainerState::build_with(
            &state.settings,
            &state.image_cache,
            "/path/to/file.unsupported",
        );

        let Err(err) = result else {
            panic!("expected an error for an unsupported extension");
        };
        assert!(err
            .to_string()
            .contains("Unsupported Container Type: unsupported"));
    }

    #[test]
    fn test_build_without_extension() {
        let state = ContainerState::default();
        let result =
            ContainerState::build_with(&state.settings, &state.image_cache, "/path/to/noextension");

        let Err(err) = result else {
            panic!("expected an error for a missing extension");
        };
        assert!(err.to_string().contains("Failed to get extension"));
    }

    #[test]
    fn test_clear_resets_container_and_image_loader() {
        use std::fs::File;
        use std::io::Write;
        use tempfile::tempdir;

        // Minimal valid 1x1 PNG.
        let png_data: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78,
            0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];

        let dir = tempdir().expect("failed to create tempdir");
        let mut file = File::create(dir.path().join("page1.png")).expect("failed to create image");
        file.write_all(png_data).expect("failed to write image");

        let mut state = ContainerState::default();

        // Build a valid directory container and install it.
        let path = dir.path().to_string_lossy().to_string();
        let service = ContainerState::build_with(&state.settings, &state.image_cache, &path)
            .expect("building a valid directory container should succeed");
        state.install(service);
        assert!(state.service_for(&path).is_some());

        // Clearing must drop the service, so we never serve images from a previously
        // opened book.
        state.clear();
        assert!(!state.is_open());
        assert!(state.service_for(&path).is_none());
    }

    #[test]
    fn pdf_render_height_is_capped_by_the_display_height() {
        let mut settings = ContainerSettings {
            pdf_render_resolution_height: 2000,
            max_image_height: 0,
            ..ContainerSettings::default()
        };

        // No display limit: render at the configured resolution.
        assert_eq!(pdf_render_height(&settings), 2000);

        // A lower display limit wins — rendering larger only to shrink it afterwards is
        // work spent on pixels nobody sees.
        settings.max_image_height = 1200;
        assert_eq!(pdf_render_height(&settings), 1200);

        // A higher one does not raise the render resolution.
        settings.max_image_height = 4000;
        assert_eq!(pdf_render_height(&settings), 2000);
    }

    #[test]
    fn test_unsupported_file_extensions() {
        let state = ContainerState::default();
        let unsupported_files = vec![
            "/path/to/file.txt",
            "/path/to/file.doc",
            "/path/to/file.jpg",
            "/path/to/file.exe",
            "/path/to/file.mp4",
        ];

        for file_path in unsupported_files {
            let result = ContainerState::build_with(&state.settings, &state.image_cache, file_path);
            let Err(err) = result else {
                panic!("File {} should be unsupported", file_path);
            };
            assert!(err.to_string().contains("Unsupported Container Type"));
        }
    }

    #[test]
    fn test_supported_file_extensions() {
        let mut state = ContainerState::default();
        state.settings.pdfium_library_path = Some(get_pdfium_lib_path());
        let supported_files = vec![
            ("/path/to/file.zip", "zip"),
            ("/path/to/file.pdf", "pdf"),
            ("/path/to/file.rar", "rar"),
        ];

        for (file_path, ext) in supported_files {
            let result = ContainerState::build_with(&state.settings, &state.image_cache, file_path);

            // These will fail because files don't exist, but we verify the
            // extension is recognized (different error message)
            if let Err(err) = result {
                // Should not be "Unsupported Container Type" error
                assert!(
                    !err.to_string().contains("Unsupported Container Type"),
                    "File {} with extension {} should be supported",
                    file_path,
                    ext
                );
            }
        }
    }

    #[test]
    fn test_case_insensitive_extension() {
        let mut state = ContainerState::default();
        state.settings.pdfium_library_path = Some(get_pdfium_lib_path());

        // Test uppercase extension
        let result =
            ContainerState::build_with(&state.settings, &state.image_cache, "/path/to/file.ZIP");
        if let Err(err) = result {
            // Should not be "Unsupported" error, meaning it recognized ZIP
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }

        // Test mixed case
        let result =
            ContainerState::build_with(&state.settings, &state.image_cache, "/path/to/file.Pdf");
        if let Err(err) = result {
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }
    }

    #[test]
    fn test_container_error_fields() {
        let state = ContainerState::default();
        let test_path = "/test/path/file.unknown".to_string();
        let result = ContainerState::build_with(&state.settings, &state.image_cache, &test_path);

        let Err(err) = result else {
            panic!("expected an error for an unknown extension");
        };
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn test_build_image_cache_stores_and_reads_back() {
        use crate::image::types::Image;
        use crate::page::cache::CacheKey;

        let cache = build_image_cache(64);
        let key = CacheKey {
            book_id: "book".to_string(),
            entry: "p1.png".to_string(),
        };
        let image = Arc::new(Image {
            data: vec![1, 2, 3],
            width: 1,
            height: 1,
        });

        cache.insert(key.clone(), image.clone());

        assert!(cache.get(&key).is_some());
    }

    #[test]
    fn test_build_image_cache_accepts_different_sizes() {
        // Both a small and a large cache should build without panicking.
        let _small = build_image_cache(1);
        let _large = build_image_cache(4096);
    }
}
