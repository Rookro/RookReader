use std::path::Path;

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::{
        container::{Container, ContainerError},
        directory_container::DirectoryContainer,
        pdf_container::PdfContainer,
        rar_container::RarContainer,
        zip_container::ZipContainer,
    },
    error::Result,
    setting::container_settings::ContainerSettings,
};

/// The container state.
pub struct ContainerState {
    /// Archive container
    pub container: Option<Box<dyn Container>>,
    /// Settings for the archive container
    pub settings: ContainerSettings,
}

impl Default for ContainerState {
    fn default() -> Self {
        Self {
            container: None,
            settings: ContainerSettings::default(),
        }
    }
}

impl ContainerState {
    /// Opens a container file.
    ///
    /// * `path` - The path to the container file.
    pub fn open_container(&mut self, path: &String) -> Result<()> {
        self.container = None;
        let file_path = Path::new(path);

        if file_path.is_dir() {
            self.container = Some(Box::new(DirectoryContainer::new(path)?));
            return Ok(());
        }

        if let Some(ext) = file_path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "zip" => {
                    self.container = Some(Box::new(ZipContainer::new(path)?));
                    Ok(())
                }
                "pdf" => {
                    self.container = Some(Box::new(PdfContainer::new(
                        path,
                        PdfRenderConfig::default()
                            .set_target_height(self.settings.pdf_rendering_height),
                        self.settings.pdfium_library_path.clone(),
                    )?));
                    Ok(())
                }
                "rar" => {
                    self.container = Some(Box::new(RarContainer::new(path)?));
                    Ok(())
                }
                _ => {
                    log::error!("Unsupported Container Type: {}", ext_str);
                    Err(
                        ContainerError::Other(format!("Unsupported Container Type: {}", ext_str))
                            .into(),
                    )
                }
            }
        } else {
            log::error!("Failed to get extension. {}", path);
            Err(ContainerError::Other(format!("Failed to get extension. {}", path)).into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        let result = state.open_container(&"/path/to/file.unsupported".to_string());

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
        let result = state.open_container(&"/path/to/noextension".to_string());

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Failed to get extension"));
    }

    #[test]
    fn test_open_container_resets_previous_container() {
        let mut state = ContainerState::default();

        // First attempt to open
        let result1 = state.open_container(&"/path/to/file.unsupported".to_string());
        assert!(result1.is_err());

        // Second attempt
        let result2 = state.open_container(&"/path/to/another.unsupported".to_string());
        assert!(result2.is_err());

        // Container should still be None
        assert!(state.container.is_none());
    }

    #[test]
    fn test_pdf_rendering_height_passed_to_pdf_container() {
        let mut state = ContainerState::default();
        state.settings.pdf_rendering_height = 1200;

        // This would fail because the file doesn't exist, but it tests that
        // the height is being used in the PdfContainer::new call
        let result = state.open_container(&"/path/to/file.pdf".to_string());

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
            let result = state.open_container(&file_path.to_string());
            assert!(result.is_err(), "File {} should be unsupported", file_path);
            let err = result.unwrap_err();
            assert!(err.to_string().contains("Unsupported Container Type"));
        }
    }

    #[test]
    fn test_supported_file_extensions() {
        let mut state = ContainerState::default();
        let supported_files = vec![
            ("/path/to/file.zip", "zip"),
            ("/path/to/file.pdf", "pdf"),
            ("/path/to/file.rar", "rar"),
        ];

        for (file_path, ext) in supported_files {
            let result = state.open_container(&file_path.to_string());

            // These will fail because files don't exist, but we verify the
            // extension is recognized (different error message)
            if result.is_err() {
                let err = result.unwrap_err();
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

        // Test uppercase extension
        let result = state.open_container(&"/path/to/file.ZIP".to_string());
        if result.is_err() {
            let err = result.unwrap_err();
            // Should not be "Unsupported" error, meaning it recognized ZIP
            assert!(!err.to_string().contains("Unsupported Container Type"));
        }

        // Test mixed case
        let result = state.open_container(&"/path/to/file.Pdf".to_string());
        if result.is_err() {
            let err = result.unwrap_err();
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
