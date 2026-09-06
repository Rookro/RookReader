use std::{path::Path, sync::Arc};

use pdfium_render::prelude::PdfRenderConfig;

use crate::{
    container::{
        archive_listing, archive_path, directory_container::DirectoryContainer,
        epub_container::EpubContainer, pdf_container::PdfContainer, rar_container::RarContainer,
        traits::Container, zip_container::ZipContainer,
    },
    error::{Error, Result},
};

/// Configuration options for creating a container.
pub struct ContainerConfig {
    /// The rendering configuration for PDF containers.
    pub pdf_render_config: PdfRenderConfig,
    /// An optional path to the directory containing the `pdfium` library.
    pub pdfium_library_path: Option<String>,
    /// If `true`, opening an archive descends through a chain of single sub-folders to
    /// the first level that actually holds pages.
    pub auto_descend_single_folder: bool,
}

impl Default for ContainerConfig {
    fn default() -> Self {
        Self {
            pdf_render_config: PdfRenderConfig::default(),
            pdfium_library_path: None,
            // Mirrors the persisted default, so tests and ad-hoc callers behave like the app.
            auto_descend_single_folder: true,
        }
    }
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
/// * The path does not exist ([`Error::PathNotFound`]).
/// * The file extension is not supported, or the path has none (and is not a directory).
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
        return create_archive_container(
            &location.archive,
            &location.inner_dir,
            config.auto_descend_single_folder,
        );
    }

    // Everything below decides the format from the extension, which is only meaningful
    // for a path that exists: a folder book that was moved away has no extension of its
    // own, and `Dr.STONE 01` would be opened as a `.stone 01` file. `try_exists` rather
    // than `exists` so an unreadable path stays an I/O error instead of "not found".
    match file_path.try_exists() {
        Ok(true) => {}
        Ok(false) => return Err(Error::PathNotFound(path.to_string())),
        Err(e) => return Err(e.into()),
    }

    if let Some(ext) = file_path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        match ext_str.as_str() {
            "zip" | "cbz" | "rar" | "cbr" => {
                create_archive_container(file_path, "", config.auto_descend_single_folder)
            }
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
        // The path exists and is not a directory, so a missing extension is simply a
        // format we cannot read.
        Err(Error::UnsupportedContainer(format!(
            "Unsupported Container Type: no extension. {}",
            path
        )))
    }
}

/// Builds the container for one folder inside a browsable archive.
///
/// When `auto_descend` is set and the requested folder holds no pages, a chain of single
/// sub-folders is followed down to the level that does (see
/// [`archive_listing::resolve_content_dir`]).
///
/// # Arguments
///
/// * `archive` - The archive file on disk.
/// * `inner_dir` - The folder inside the archive; empty means the archive root.
/// * `auto_descend` - Whether to descend through single sub-folders to the pages.
///
/// # Returns
///
/// A `Result` containing a shared pointer to the created `Container`.
///
/// # Errors
///
/// Returns an `Err` if the archive format is not browsable or the underlying
/// constructor fails.
fn create_archive_container(
    archive: &Path,
    inner_dir: &str,
    auto_descend: bool,
) -> Result<Arc<dyn Container>> {
    let container = open_archive_at(archive, inner_dir)?;

    // An empty container means this level holds no pages, which is the only case where
    // descending can help — and it is the same condition `descend_to_content` tests. So
    // the archive listing is read a second time only when it might change the answer,
    // keeping the common open to a single pass.
    if !auto_descend || !container.get_entries().is_empty() {
        return Ok(container);
    }

    let content_dir = archive_listing::resolve_content_dir(archive, inner_dir)?;
    if content_dir == inner_dir {
        return Ok(container);
    }
    open_archive_at(archive, &content_dir)
}

/// Opens one folder inside a browsable archive, exactly as asked.
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
fn open_archive_at(archive: &Path, inner_dir: &str) -> Result<Arc<dyn Container>> {
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
        // The fixtures must exist: a missing path is now rejected as "not found" before
        // the extension is ever looked at, which would hide a drift here.
        let dir = tempfile::tempdir().expect("tempdir");
        for ext in crate::container::traits::SUPPORTED_EXTENSIONS {
            let file = dir.path().join(format!("file.{ext}"));
            std::fs::write(&file, b"").expect("create fixture");
            // Provide the pdfium path so the .pdf branch binds via Result (Pdfium::default
            // would panic if no library is found); the file is empty either way.
            let config = ContainerConfig {
                pdfium_library_path: Some(get_pdfium_lib_path()),
                ..Default::default()
            };
            let result = create_container(file.to_string_lossy().as_ref(), config);

            // Construction fails (the file is not a real archive) but never with
            // "Unsupported Container Type" — that would mean the factory and
            // SUPPORTED_EXTENSIONS drifted.
            let err = result.err().map(|e| e.to_string()).unwrap_or_default();
            assert!(
                !err.contains("Unsupported Container Type"),
                "factory missing .{ext}"
            );
        }
    }

    #[test]
    fn test_create_container_unsupported_extension() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file = dir.path().join("file.unsupported");
        std::fs::write(&file, b"").expect("create fixture");

        let result = create_container(file.to_string_lossy().as_ref(), ContainerConfig::default());

        let err = result.err().expect("expected an error");
        assert!(err
            .to_string()
            .contains("Unsupported Container Type: unsupported"));
    }

    #[test]
    fn test_create_container_no_extension() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file = dir.path().join("noextension");
        std::fs::write(&file, b"").expect("create fixture");

        let result = create_container(file.to_string_lossy().as_ref(), ContainerConfig::default());

        assert!(matches!(result, Err(Error::UnsupportedContainer(_))));
    }

    #[test]
    fn test_create_container_reports_a_missing_folder_book_as_not_found() {
        // A dot in a folder name used to be read as an extension, so a folder book that
        // had been moved away was reported as an unsupported format.
        let dir = tempfile::tempdir().expect("tempdir");
        let missing = dir.path().join("Dr.STONE 01");

        let result = create_container(
            missing.to_string_lossy().as_ref(),
            ContainerConfig::default(),
        );

        assert!(matches!(result, Err(Error::PathNotFound(_))));
    }

    #[test]
    fn test_create_container_reports_a_missing_archive_as_not_found() {
        let dir = tempfile::tempdir().expect("tempdir");
        let missing = dir.path().join("comic.zip");

        let result = create_container(
            missing.to_string_lossy().as_ref(),
            ContainerConfig::default(),
        );

        assert!(matches!(result, Err(Error::PathNotFound(_))));
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
    fn test_create_container_descends_into_a_single_wrapper_folder() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = create_test_zip(dir.path(), &["Comic/path/deep/001.png"]);

        let container = create_container(
            zip_path.to_string_lossy().as_ref(),
            ContainerConfig::default(),
        )
        .expect("descends to the pages");

        assert_eq!(vec!["001.png".to_string()], *container.get_entries());
    }

    #[test]
    fn test_create_container_keeps_the_level_when_descending_cannot_help() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = create_test_zip(dir.path(), &["ch1/001.png", "ch2/001.png"]);

        let container = create_container(
            zip_path.to_string_lossy().as_ref(),
            ContainerConfig::default(),
        )
        .expect("opens the root");

        // Two sub-folders, so there is nothing to descend into: the empty root is
        // returned and the command layer rejects it as a container with no pages.
        assert!(container.get_entries().is_empty());
    }

    #[test]
    fn test_create_container_does_not_descend_when_the_setting_is_off() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = create_test_zip(dir.path(), &["Comic/001.png"]);

        let container = create_container(
            zip_path.to_string_lossy().as_ref(),
            ContainerConfig {
                auto_descend_single_folder: false,
                ..Default::default()
            },
        )
        .expect("opens the root");

        assert!(container.get_entries().is_empty());
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
