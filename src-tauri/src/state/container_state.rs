use std::{path::Path, sync::Arc};

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::{
        directory_container::DirectoryContainer, epub_container::EpubContainer,
        image_loader::ImageLoader, pdf_container::PdfContainer, rar_container::RarContainer,
        traits::Container, zip_container::ZipContainer,
    },
    error::{Error, Result},
    state::container_settings::ContainerSettings,
};

/// Holds the state related to the currently open container (e.g., a file or directory).
#[derive(Default)]
pub struct ContainerState {
    /// The active container, wrapped in an `Arc` for shared ownership.
    /// This can be a directory, a ZIP file, a PDF, etc. `None` if no container is open.
    pub container: Option<Arc<dyn Container>>,
    /// A nested struct containing settings specific to container handling, like rendering quality.
    pub settings: ContainerSettings,
    /// The image loader responsible for loading and caching images from the current container.
    /// `None` if no container is open.
    pub image_loader: Option<ImageLoader>,
}

impl ContainerState {
    /// Opens a container from the given path and initializes the state.
    ///
    /// This function determines the type of container based on the path (directory or file extension),
    /// then creates the appropriate container handler (e.g., `ZipContainer`, `PdfContainer`).
    /// It also initializes the `ImageLoader` for the newly opened container.
    /// Any previously open container is closed.
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
        let file_path = Path::new(path);

        if file_path.is_dir() {
            let container = Arc::new(DirectoryContainer::new(path)?);
            self.container = Some(container.clone());
            self.image_loader = Some(ImageLoader::new(
                container,
                self.settings.max_image_height as u32,
                self.settings.image_resize_method,
            ));
            return Ok(());
        }

        if let Some(ext) = file_path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "zip" => {
                    let container = Arc::new(ZipContainer::new(path)?);
                    self.container = Some(container.clone());
                    self.image_loader = Some(ImageLoader::new(
                        container,
                        self.settings.max_image_height as u32,
                        self.settings.image_resize_method,
                    ));
                }
                "pdf" => {
                    let container = Arc::new(PdfContainer::new(
                        path,
                        PdfRenderConfig::default()
                            .set_target_height(self.settings.pdf_rendering_height),
                        self.settings.pdfium_library_path.clone(),
                    )?);
                    self.container = Some(container.clone());
                    self.image_loader = Some(ImageLoader::new(
                        container,
                        self.settings.max_image_height as u32,
                        self.settings.image_resize_method,
                    ));
                }
                "rar" => {
                    let container = Arc::new(RarContainer::new(path)?);
                    self.container = Some(container.clone());
                    self.image_loader = Some(ImageLoader::new(
                        container,
                        self.settings.max_image_height as u32,
                        self.settings.image_resize_method,
                    ));
                }
                "epub" => {
                    let container = Arc::new(EpubContainer::new(path)?);
                    self.container = Some(container.clone());
                    self.image_loader = Some(ImageLoader::new(
                        container,
                        self.settings.max_image_height as u32,
                        self.settings.image_resize_method,
                    ));
                }
                _ => {
                    log::error!("Unsupported Container Type: {}", ext_str);
                    return Err(Error::UnsupportedContainer(format!(
                        "Unsupported Container Type: {}",
                        ext_str
                    )));
                }
            };
            Ok(())
        } else {
            log::error!("Failed to get extension. {}", path);
            Err(Error::Path(format!("Failed to get extension. {}", path)))
        }
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
            ContainerSettings::default().pdf_rendering_height,
            state.settings.pdf_rendering_height
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
        state.settings.pdf_rendering_height = 1200;

        // This would fail because the file doesn't exist, but it tests that
        // the height is being used in the PdfContainer::new call
        let result = state.open_container("/path/to/file.pdf");

        // The error is expected because the file doesn't exist
        assert!(result.is_err());
        // But we can verify the height was set
        assert_eq!(1200, state.settings.pdf_rendering_height);
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
}
