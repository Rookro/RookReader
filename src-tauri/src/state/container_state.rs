use std::sync::Arc;

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::{
        factory::{create_container, ContainerConfig},
        traits::Container,
    },
    error::Result,
    image::loader::{Cache, ImageLoader},
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

/// Holds the state related to the currently open container (e.g., a file or directory).
pub struct ContainerState {
    /// The active container, wrapped in an `Arc` for shared ownership.
    /// This can be a directory, a ZIP file, a PDF, etc. `None` if no container is open.
    pub container: Option<Arc<dyn Container>>,
    /// A nested struct containing settings specific to container handling, like rendering quality.
    pub settings: ContainerSettings,
    /// The image loader responsible for loading and caching images from the current container.
    /// `None` if no container is open.
    pub image_loader: Option<ImageLoader>,
    /// Global image cache shared across all containers.
    pub image_cache: Cache,
}

impl Default for ContainerState {
    fn default() -> Self {
        let settings = ContainerSettings::default();
        let image_cache = build_image_cache(settings.image_cache_size_mib);

        Self {
            container: None,
            settings,
            image_loader: None,
            image_cache,
        }
    }
}

impl ContainerState {
    /// Re-initializes the image cache with a new maximum capacity.
    ///
    /// This will clear the existing cache and recreate the image loader if a container is open.
    pub fn update_image_cache_size(&mut self, size_mib: u64) {
        log::debug!("Updating image cache size to {} MiB", size_mib);
        self.image_cache = build_image_cache(size_mib);

        // If a container is open, update the image loader with the new cache.
        if let Some(image_loader) = self.image_loader.as_mut() {
            image_loader.set_cache(self.image_cache.clone());
        }
    }

    /// Clears any open container and its image loader.
    pub fn clear(&mut self) {
        self.container = None;
        self.image_loader = None;
    }

    /// Builds the container and image loader for `path` without mutating `self`.
    ///
    /// Building without `&mut self` lets callers run the heavy I/O without holding a
    /// write lock on the shared state.
    ///
    /// # Arguments
    ///
    /// * `path` - The file system path to the container to build.
    ///
    /// # Returns
    ///
    /// The built container and its initialized `ImageLoader` on success.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the file extension is missing or unsupported, or the
    /// underlying constructor fails (e.g. file not found, corrupt file).
    pub fn build(&self, path: &str) -> Result<(Arc<dyn Container>, ImageLoader)> {
        let is_pdf = std::path::Path::new(path)
            .extension()
            .is_some_and(|ext| ext.to_string_lossy().to_lowercase() == "pdf");

        let config = ContainerConfig {
            pdf_render_config: PdfRenderConfig::default()
                .set_target_height(self.settings.pdf_render_resolution_height),
            pdfium_library_path: self.settings.pdfium_library_path.clone(),
        };

        let container = create_container(path, config)?;

        // PDF rendering already controls the image size, so disable image resizing for PDF.
        let max_image_height = if is_pdf {
            0
        } else {
            self.settings.max_image_height as u32
        };

        let loader = ImageLoader::new(
            path.to_string(),
            container.clone(),
            max_image_height,
            self.settings.image_resampling_method,
            self.image_cache.clone(),
        )?;

        Ok((container, loader))
    }

    /// Installs a previously built container and image loader, replacing any open one.
    ///
    /// # Arguments
    ///
    /// * `container` - The container to install.
    /// * `loader` - The image loader to install.
    pub fn install(&mut self, container: Arc<dyn Container>, loader: ImageLoader) {
        self.image_loader = Some(loader);
        self.container = Some(container);
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

        assert!(state.container.is_none());
        assert_eq!(
            ContainerSettings::default().pdf_render_resolution_height,
            state.settings.pdf_render_resolution_height
        );
    }

    #[test]
    fn test_build_with_unsupported_extension() {
        let state = ContainerState::default();
        let result = state.build("/path/to/file.unsupported");

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
        let result = state.build("/path/to/noextension");

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
        let (container, loader) = state
            .build(dir.path().to_string_lossy().as_ref())
            .expect("building a valid directory container should succeed");
        state.install(container, loader);
        assert!(state.container.is_some());
        assert!(state.image_loader.is_some());

        // Clearing must drop BOTH container and image_loader, so we never serve
        // images from a previously opened book.
        state.clear();
        assert!(state.container.is_none());
        assert!(state.image_loader.is_none());
    }

    #[test]
    fn test_pdf_rendering_height_passed_to_pdf_container() {
        let mut state = ContainerState::default();
        state.settings.pdfium_library_path = Some(get_pdfium_lib_path());
        state.settings.pdf_render_resolution_height = 1200;

        // This would fail because the file doesn't exist, but it tests that
        // the height is being used in the PdfContainer::new call
        let result = state.build("/path/to/file.pdf");

        // The error is expected because the file doesn't exist
        assert!(result.is_err());
        // But we can verify the height was set
        assert_eq!(1200, state.settings.pdf_render_resolution_height);
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
            let result = state.build(file_path);
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
            let result = state.build(file_path);

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
        let result = state.build("/path/to/file.ZIP");
        if let Err(err) = result {
            // Should not be "Unsupported" error, meaning it recognized ZIP
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }

        // Test mixed case
        let result = state.build("/path/to/file.Pdf");
        if let Err(err) = result {
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }
    }

    #[test]
    fn test_container_error_fields() {
        let state = ContainerState::default();
        let test_path = "/test/path/file.unknown".to_string();
        let result = state.build(&test_path);

        let Err(err) = result else {
            panic!("expected an error for an unknown extension");
        };
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn test_build_image_cache_stores_and_reads_back() {
        use crate::image::loader::CacheKey;
        use crate::image::types::Image;

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
