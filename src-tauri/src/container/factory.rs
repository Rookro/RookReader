use std::{path::Path, sync::Arc};

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::{
        archive_path, directory_container::DirectoryContainer, epub_container::EpubContainer,
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

    // A path pointing inside an archive (e.g. `comic.zip/ch1`) opens that folder as its
    // own book. Real filesystem paths are matched first, so a folder named `foo.zip` is
    // unaffected.
    if let Some(location) = archive_path::resolve(path) {
        return create_archive_container(&location.archive, &location.inner_dir);
    }

    if let Some(ext) = file_path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        match ext_str.as_str() {
            "zip" | "cbz" | "rar" | "cbr" => create_archive_container(file_path, ""),
            "pdf" => Ok(Arc::new(PdfContainer::new(
                path,
                config.pdf_render_config,
                config.pdfium_library_path,
            )?)),
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

/// Builds the container for one folder inside a browsable archive.
///
/// # Arguments
///
/// * `archive` - The archive file on disk.
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
///
/// # Returns
///
/// A `Result` containing a shared pointer to the created `Container`.
///
/// # Errors
///
/// Returns an `Err` if the archive format is not browsable or the underlying
/// constructor fails.
fn create_archive_container(archive: &Path, inner_dir: &str) -> Result<Arc<dyn Container>> {
    let path = archive.to_string_lossy();
    let ext = archive
        .extension()
        .map(|ext| ext.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "zip" | "cbz" => Ok(Arc::new(ZipContainer::new(&path, inner_dir)?)),
        "rar" | "cbr" => Ok(Arc::new(RarContainer::new(&path, inner_dir)?)),
        _ => Err(Error::UnsupportedContainer(format!(
            "Unsupported Container Type: {ext}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use std::path;

    use super::*;

    fn get_pdfium_lib_path() -> String {
        let pdfium_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("dependencies")
            .join("pdfium");

        let lib_path = if pdfium_path.join("bin").exists() {
            pdfium_path.join("bin")
        } else {
            pdfium_path.join("lib")
        };

        lib_path.to_string_lossy().to_string()
    }

    #[test]
    fn test_factory_covers_all_supported_extensions() {
        for ext in crate::container::traits::SUPPORTED_EXTENSIONS {
            // Provide the pdfium path so the .pdf branch binds via Result (Pdfium::default
            // would panic if no library is found); the file is missing either way.
            let config = ContainerConfig {
                pdfium_library_path: Some(get_pdfium_lib_path()),
                ..Default::default()
            };
            let result = create_container(&format!("/nonexistent/file.{ext}"), config);

            // Construction fails (file missing) but never with "Unsupported Container
            // Type" — that would mean the factory and SUPPORTED_EXTENSIONS drifted.
            let err = result.err().map(|e| e.to_string()).unwrap_or_default();
            assert!(
                !err.contains("Unsupported Container Type"),
                "factory missing .{ext}"
            );
        }
    }

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

    /// Builds a ZIP with the given entry names and one dummy byte each.
    fn create_test_zip(dir: &path::Path, names: &[&str]) -> path::PathBuf {
        use std::io::Write;
        use zip::write::{FileOptions, ZipWriter};

        let zip_path = dir.join("nested.zip");
        let mut zip = ZipWriter::new(std::fs::File::create(&zip_path).expect("create zip"));
        for name in names {
            zip.start_file(*name, FileOptions::<()>::default())
                .expect("start entry");
            zip.write_all(&[0u8]).expect("write entry");
        }
        zip.finish().expect("finish zip");
        zip_path
    }

    #[test]
    fn test_create_container_opens_a_folder_inside_a_zip() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = create_test_zip(dir.path(), &["cover.png", "ch1/001.png"]);

        let inner = zip_path.join("ch1");
        let container =
            create_container(inner.to_string_lossy().as_ref(), ContainerConfig::default())
                .expect("opens the folder inside the archive");

        assert_eq!(vec!["001.png".to_string()], *container.get_entries());
        assert!(!container.is_directory());
    }

    #[test]
    fn test_create_container_opens_the_archive_root_without_sub_folders() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = create_test_zip(dir.path(), &["cover.png", "ch1/001.png"]);

        let container = create_container(
            zip_path.to_string_lossy().as_ref(),
            ContainerConfig::default(),
        )
        .expect("opens the archive root");

        assert_eq!(vec!["cover.png".to_string()], *container.get_entries());
    }

    #[test]
    fn test_create_container_treats_a_real_zip_named_folder_as_a_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        let folder = dir.path().join("comic.zip");
        std::fs::create_dir(&folder).expect("create dir");

        let container = create_container(
            folder.to_string_lossy().as_ref(),
            ContainerConfig::default(),
        )
        .expect("opens as a directory");

        assert!(container.is_directory());
    }
}
