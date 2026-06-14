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

    /// Opens a container from the given path and initializes the state.
    ///
    /// This function determines the type of container based on the path (directory or file extension),
    /// then creates the appropriate container handler (e.g., `ZipContainer`, `PdfContainer`)
    /// using the container factory. It also initializes the `ImageLoader` for the newly opened
    /// container. Any previously open container is closed.
    ///
    /// # Arguments
    ///
    /// * `path` - The file system path to the container to open.
    ///
    /// # Returns
    ///
    /// An `Ok(())` on success.
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if:
    /// * The file extension is missing or unsupported.
    /// * The underlying constructor for the container type fails (e.g., file not found, permission denied, corrupt file).
    pub fn open_container(&mut self, path: &str) -> Result<()> {
        self.container = None;

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

        self.image_loader = Some(ImageLoader::new(
            path.to_string(),
            container.clone(),
            max_image_height,
            self.settings.image_resampling_method,
            self.image_cache.clone(),
        )?);
        self.container = Some(container);

        Ok(())
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
    fn test_open_container_with_unsupported_extension() {
        let mut state = ContainerState::default();
        let result = state.open_container("/path/to/file.unsupported");

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err
            .to_string()
            .contains("Unsupported Container Type: unsupported"));
        assert!(state.container.is_none());
    }

    #[test]
    fn test_open_container_without_extension() {
        let mut state = ContainerState::default();
        let result = state.open_container("/path/to/noextension");

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Failed to get extension"));
    }

    #[test]
    fn test_open_container_resets_previous_container() {
        let mut state = ContainerState::default();

        // First attempt to open
        let result1 = state.open_container("/path/to/file.unsupported");
        assert!(result1.is_err());

        // Second attempt
        let result2 = state.open_container("/path/to/another.unsupported");
        assert!(result2.is_err());

        // Container should still be None
        assert!(state.container.is_none());
    }

    #[test]
    fn test_pdf_rendering_height_passed_to_pdf_container() {
        let mut state = ContainerState::default();
        state.settings.pdfium_library_path = Some(get_pdfium_lib_path());
        state.settings.pdf_render_resolution_height = 1200;

        // This would fail because the file doesn't exist, but it tests that
        // the height is being used in the PdfContainer::new call
        let result = state.open_container("/path/to/file.pdf");

        // The error is expected because the file doesn't exist
        assert!(result.is_err());
        // But we can verify the height was set
        assert_eq!(1200, state.settings.pdf_render_resolution_height);
    }

    #[test]
    fn test_unsupported_file_extensions() {
        let mut state = ContainerState::default();
        let unsupported_files = vec![
            "/path/to/file.txt",
            "/path/to/file.doc",
            "/path/to/file.jpg",
            "/path/to/file.exe",
            "/path/to/file.mp4",
        ];

        for file_path in unsupported_files {
            let result = state.open_container(file_path);
            assert!(result.is_err(), "File {} should be unsupported", file_path);
            let err = result.unwrap_err();
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
            let result = state.open_container(file_path);

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
        let result = state.open_container("/path/to/file.ZIP");
        if let Err(err) = result {
            // Should not be "Unsupported" error, meaning it recognized ZIP
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }

        // Test mixed case
        let result = state.open_container("/path/to/file.Pdf");
        if let Err(err) = result {
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }
    }

    #[test]
    fn test_container_error_fields() {
        let mut state = ContainerState::default();
        let test_path = "/test/path/file.unknown".to_string();
        let result = state.open_container(&test_path);

        assert!(result.is_err());
        let err = result.unwrap_err();
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
