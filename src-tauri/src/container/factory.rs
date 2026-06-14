use std::{path::Path, sync::Arc};

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::{
        directory_container::DirectoryContainer, epub_container::EpubContainer,
        pdf_container::PdfContainer, rar_container::RarContainer, traits::Container,
        zip_container::ZipContainer,
    },
    error::{Error, Result},
};

/// Configuration options for creating a container.
#[derive(Default)]
pub struct ContainerConfig {
    /// The rendering configuration for PDF containers.
    pub pdf_render_config: PdfRenderConfig,
    /// An optional path to the directory containing the `pdfium` library.
    pub pdfium_library_path: Option<String>,
}

/// Creates a `Container` from a file path based on its type (directory or file extension).
///
/// This function consolidates container creation logic that was previously duplicated
/// across `ContainerState::open_container`, `book_commands::generate_and_save_thumbnail`,
/// and `container_commands::determine_epub_novel`.
///
/// # Arguments
///
/// * `path` - The file system path to the container.
/// * `config` - Configuration options for container creation (e.g., PDF render settings).
///
/// # Returns
///
/// A `Result` containing a shared pointer to the created `Container`.
///
/// # Errors
///
/// Returns an `Err` if:
/// * The path has no file extension (and is not a directory).
/// * The file extension is not supported.
/// * The underlying container constructor fails.
pub fn create_container(path: &str, config: ContainerConfig) -> Result<Arc<dyn Container>> {
    let file_path = Path::new(path);

    if file_path.is_dir() {
        return Ok(Arc::new(DirectoryContainer::new(path)?));
    }

    if let Some(ext) = file_path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        match ext_str.as_str() {
            "zip" => Ok(Arc::new(ZipContainer::new(path)?)),
            "pdf" => Ok(Arc::new(PdfContainer::new(
                path,
                config.pdf_render_config,
                config.pdfium_library_path,
            )?)),
            "rar" => Ok(Arc::new(RarContainer::new(path)?)),
            "epub" => Ok(Arc::new(EpubContainer::new(path)?)),
            _ => Err(Error::UnsupportedContainer(format!(
                "Unsupported Container Type: {}",
                ext_str
            ))),
        }
    } else {
        Err(Error::Path(format!("Failed to get extension. {}", path)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_container_unsupported_extension() {
        let result = create_container("/path/to/file.unsupported", ContainerConfig::default());
        assert!(result.is_err());
        let err = result.err().unwrap();
        assert!(err
            .to_string()
            .contains("Unsupported Container Type: unsupported"));
    }

    #[test]
    fn test_create_container_no_extension() {
        let result = create_container("/path/to/noextension", ContainerConfig::default());
        assert!(result.is_err());
        let err = result.err().unwrap();
        assert!(err.to_string().contains("Failed to get extension"));
    }
}
