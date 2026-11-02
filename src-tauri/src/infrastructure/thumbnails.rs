//! The cover thumbnails the library stores beside its database: their names, writing them
//! from a book's container, and removing them.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::{Manager, Runtime};

use crate::blocking::run_blocking;
use crate::container::traits::Container;
use crate::error::Result;
use crate::infrastructure::atomic_file::write_atomically;
use crate::page::pipeline::Pipeline;

/// The file name a book's thumbnail is stored under.
///
/// `v2` marks covers made at the current size. A book that still has only the
/// [`legacy_file_name`] misses here, so the next open makes a new cover.
///
/// # Arguments
///
/// * `file_path` - The book's path, which is unique in the library.
///
/// # Returns
///
/// `thumbnail_v2_<16 hex digits>.jpg`.
pub fn file_name(file_path: &str) -> String {
    format!("thumbnail_v2_{:016x}.jpg", path_hash(file_path))
}

/// The file name a book's thumbnail had before `v2`, kept so the old file can be removed
/// once a new cover replaces it.
///
/// # Arguments
///
/// * `file_path` - The book's path, which is unique in the library.
///
/// # Returns
///
/// `thumbnail_<16 hex digits>.jpg`.
pub fn legacy_file_name(file_path: &str) -> String {
    format!("thumbnail_{:016x}.jpg", path_hash(file_path))
}

/// Hashes a book's path for its thumbnail file name.
///
/// FNV-1a, so the name is the same on every Rust release: `DefaultHasher` makes no such
/// promise, and a change to it would orphan every thumbnail on disk.
fn path_hash(file_path: &str) -> u64 {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    file_path.bytes().fold(OFFSET_BASIS, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(PRIME)
    })
}

/// Writes the cover of a book into `dir`, or finds the one already there.
///
/// When a new cover is written, the one an earlier version saved for the same book (see
/// [`legacy_file_name`]) is removed.
///
/// # Arguments
///
/// * `dir` - The folder thumbnails are stored in; created if missing.
/// * `file_path` - The unique file or directory path of the book.
/// * `container` - The book's opened container.
///
/// # Returns
///
/// The path of the new or existing cover, or `None` if the book contains no images.
///
/// # Errors
///
/// Returns an `Err` if the folder cannot be created, the cover cannot be read or made, or
/// the file cannot be written.
pub fn save_cover(
    dir: &Path,
    file_path: &str,
    container: &dyn Container,
) -> Result<Option<PathBuf>> {
    if !dir.exists() {
        fs::create_dir_all(dir)?;
    }

    let thumbnail_path = dir.join(file_name(file_path));

    if thumbnail_path.exists() {
        return Ok(Some(thumbnail_path));
    }

    let Some(entry) = container.get_entries().first() else {
        // EPUB Novel doesn't have any image.
        log::warn!("Failed to get thumbnail for {}. No image found.", file_path);
        return Ok(None);
    };

    // Ask the reader for a cover first. For PDF that renders a cover-sized page through
    // the one worker that owns the library, instead of binding a second `Pdfium` beside
    // the one an open book is already using. Every other format has no cheaper path, so
    // its page is read in full and shrunk here.
    let mut reader = container.open_reader()?;
    match reader.read_cover(entry)? {
        Some(bytes) => write_atomically(&thumbnail_path, &bytes)?,
        None => {
            let page = reader.read_page(entry)?;
            write_atomically(&thumbnail_path, &Pipeline::thumbnail(&page)?.data)?;
        }
    }

    // Best effort: a leftover only costs disk space, and the new cover is saved.
    let legacy_path = dir.join(legacy_file_name(file_path));
    match fs::remove_file(&legacy_path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => log::warn!(
            "Could not remove a legacy thumbnail {}: {e}",
            legacy_path.display()
        ),
    }

    Ok(Some(thumbnail_path))
}

/// The cover of a book in the app's thumbnail folder, made on a blocking thread when it
/// is not there yet.
///
/// # Arguments
///
/// * `app` - The app, which locates the thumbnail folder.
/// * `file_path` - The unique file or directory path of the book.
/// * `container` - The book's opened container.
///
/// # Returns
///
/// The cover's path, or `None` when the book has no image or the cover could not be made.
/// A failure is logged rather than returned: a book is registered without a cover rather
/// than not at all.
pub async fn cover_for<R: Runtime, M: Manager<R>>(
    app: &M,
    file_path: &str,
    container: Arc<dyn Container>,
) -> Option<String> {
    let made = match crate::setup::app_data_dir(app) {
        Ok(data_dir) => {
            let dir = data_dir.join("thumbnails");
            let path = file_path.to_string();
            run_blocking(move || save_cover(&dir, &path, container.as_ref())).await
        }
        Err(e) => Err(e),
    };
    match made {
        Ok(cover) => cover.map(|path| path.to_string_lossy().to_string()),
        Err(e) => {
            log::warn!("Thumbnail of {} generation failed: {}", file_path, e);
            None
        }
    }
}

/// Removes a thumbnail file. Best effort: the book it belonged to is already gone, so a
/// file that cannot be removed is logged, not reported, and a missing one is fine.
///
/// # Arguments
///
/// * `path` - The thumbnail file to remove.
pub async fn remove(path: String) {
    let target = path.clone();
    let removed = run_blocking(move || match fs::remove_file(&target) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        other => other,
    })
    .await;
    if let Err(e) = removed {
        log::warn!("Could not remove a thumbnail {path}: {e}");
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;
    use std::sync::Arc;

    use super::*;
    use crate::container::factory::{create_container, ContainerConfig};
    use crate::container::traits::MockContainer;
    use crate::error::Error;

    #[test]
    fn file_name_is_fnv1a_of_the_path() {
        assert_eq!(file_name(""), "thumbnail_v2_cbf29ce484222325.jpg");
        assert_eq!(file_name("a"), "thumbnail_v2_af63dc4c8601ec8c.jpg");
        assert_eq!(file_name("foobar"), "thumbnail_v2_85944171f73967e8.jpg");
    }

    #[test]
    fn legacy_file_name_is_the_pre_v2_name() {
        // What earlier versions wrote; it must keep resolving so the file can be removed.
        assert_eq!(legacy_file_name("foobar"), "thumbnail_85944171f73967e8.jpg");
    }

    #[test]
    fn save_cover_replaces_the_legacy_thumbnail() {
        let dir = tempfile::tempdir().unwrap();
        // A folder of images is a book, read without any fixture archive.
        let book = tempfile::tempdir().unwrap();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(1200, 1800))
            .save(book.path().join("001.png"))
            .unwrap();
        let file_path = book.path().to_string_lossy().to_string();
        let legacy = dir.path().join(legacy_file_name(&file_path));
        std::fs::write(&legacy, "a thumbnail from an earlier version").unwrap();
        let container = create_container(&file_path, ContainerConfig::default()).unwrap();

        let path = save_cover(dir.path(), &file_path, container.as_ref())
            .unwrap()
            .expect("a folder of images has a thumbnail");

        assert!(!legacy.exists());
        let size = crate::image::types::read_dimensions(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(size.height, crate::image::thumbnail::COVER.max_size);
    }

    #[test]
    fn save_cover_finds_no_cover_at_an_archive_root_without_pages() {
        use zip::write::{FileOptions, ZipWriter};

        let dir = tempfile::tempdir().unwrap();
        let books = tempfile::tempdir().unwrap();
        let zip_path = books.path().join("nested.zip");
        let mut page = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(4, 4))
            .write_to(
                &mut std::io::Cursor::new(&mut page),
                image::ImageFormat::Png,
            )
            .unwrap();
        let mut zip = ZipWriter::new(std::fs::File::create(&zip_path).unwrap());
        zip.start_file("Vol1/p1.png", FileOptions::<()>::default())
            .unwrap();
        zip.write_all(&page).unwrap();
        zip.finish().unwrap();
        let file_path = zip_path.to_string_lossy().to_string();
        let at_the_root = ContainerConfig {
            auto_descend_single_folder: false,
            ..ContainerConfig::default()
        };
        let container = create_container(&file_path, at_the_root).unwrap();

        let cover = save_cover(dir.path(), &file_path, container.as_ref()).unwrap();

        assert!(cover.is_none());
    }

    #[test]
    fn save_cover_reuses_an_existing_cover() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = "fake_path_that_does_not_exist.zip";
        let existing = dir.path().join(file_name(file_path));
        std::fs::write(&existing, "dummy image data").unwrap();
        let mut container = MockContainer::new();
        container.expect_get_entries().times(0);
        container.expect_open_reader().times(0);

        let cover = save_cover(dir.path(), file_path, &container).unwrap();

        assert_eq!(cover, Some(existing));
    }

    #[tokio::test]
    async fn cover_for_is_none_when_the_cover_cannot_be_made() {
        let mut container = MockContainer::new();
        container
            .expect_get_entries()
            .times(1)
            .return_const(vec!["p1.png".to_string()]);
        container
            .expect_open_reader()
            .times(1)
            .returning(|| Err(Error::Other("unreadable".to_string())));
        let app = tauri::test::mock_app();
        // A path no earlier run has a cover for, so the reader is reached.
        let file_path = format!("cover-for-failure-{}", std::process::id());

        assert_eq!(cover_for(&app, &file_path, Arc::new(container)).await, None);
    }

    #[tokio::test]
    async fn remove_ignores_a_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gone.jpg");

        remove(path.to_string_lossy().into_owned()).await;

        assert!(!path.exists());
    }
}
