//! Describes a book from its opened container.

use std::path::Path;

use crate::container::archive_path;
use crate::container::traits::Container;
use crate::domain::book::entity::ItemType;
use crate::error::{Error, Result};

/// A book as its opened container describes it: what the library records about it, and
/// whether it is a novel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookDescription {
    /// A folder of pages (including a folder inside an archive), or a single file.
    pub item_type: ItemType,
    /// The last component of the book's path.
    pub display_name: String,
    /// The number of page entries.
    pub total_pages: i64,
    /// Whether the book is an EPUB novel rather than a comic.
    pub is_novel: bool,
}

/// Describes the book at `path` from its opened container.
///
/// # Arguments
///
/// * `path` - The book's path, as the container was opened from.
/// * `container` - The container opened from `path`.
///
/// # Returns
///
/// The book's item type, display name, page count, and whether it is a novel.
///
/// # Errors
///
/// Returns `EmptyContainer` when the container holds no readable pages. EPUB novels are
/// exempt: their text has no image entries.
pub fn describe(path: &str, container: &dyn Container) -> Result<BookDescription> {
    let is_novel = container.is_novel();
    let total_pages = container.get_entries().len();
    if !is_novel && total_pages == 0 {
        return Err(Error::EmptyContainer(path.to_string()));
    }

    let item_type = if container.is_directory() || archive_path::resolve(path).is_some() {
        ItemType::Directory
    } else {
        ItemType::File
    };
    let display_name = Path::new(path).file_name().map_or_else(
        || path.to_string(),
        |name| name.to_string_lossy().into_owned(),
    );

    Ok(BookDescription {
        item_type,
        display_name,
        total_pages: total_pages as i64,
        is_novel,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::container::traits::MockContainer;
    use crate::domain::book::entity::ItemType;
    use crate::error::Error;

    fn container(entries: usize, is_directory: bool, is_novel: bool) -> MockContainer {
        let mut container = MockContainer::new();
        container
            .expect_get_entries()
            .return_const((0..entries).map(|i| format!("{i}.png")).collect::<Vec<_>>());
        container.expect_is_directory().return_const(is_directory);
        container.expect_is_novel().return_const(is_novel);
        container
    }

    #[test]
    fn a_folder_is_a_directory_named_after_itself() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("My Book");
        std::fs::create_dir(&path).unwrap();

        let description = describe(&path.to_string_lossy(), &container(2, true, false)).unwrap();

        assert_eq!(
            description,
            BookDescription {
                item_type: ItemType::Directory,
                display_name: "My Book".to_string(),
                total_pages: 2,
                is_novel: false,
            }
        );
    }

    #[test]
    fn an_archive_is_a_file_named_after_itself() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("comic.zip");
        std::fs::write(&path, b"").unwrap();

        let description = describe(&path.to_string_lossy(), &container(3, false, false)).unwrap();

        assert_eq!(description.item_type, ItemType::File);
        assert_eq!(description.display_name, "comic.zip");
        assert_eq!(description.total_pages, 3);
    }

    #[test]
    fn a_folder_inside_an_archive_is_a_directory() {
        use std::io::Write;
        use zip::write::{FileOptions, ZipWriter};

        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("nested.zip");
        let mut zip = ZipWriter::new(std::fs::File::create(&zip_path).unwrap());
        zip.start_file("Vol1/p1.png", FileOptions::<()>::default())
            .unwrap();
        zip.write_all(b"page").unwrap();
        zip.finish().unwrap();
        let path = zip_path.join("Vol1");

        let description = describe(&path.to_string_lossy(), &container(1, false, false)).unwrap();

        assert_eq!(description.item_type, ItemType::Directory);
        assert_eq!(description.display_name, "Vol1");
    }

    #[test]
    fn a_file_in_a_real_folder_named_like_an_archive_is_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path().join("x.zip");
        std::fs::create_dir(&folder).unwrap();
        let path = folder.join("book.pdf");
        std::fs::write(&path, b"").unwrap();

        let description = describe(&path.to_string_lossy(), &container(1, false, false)).unwrap();

        assert_eq!(description.item_type, ItemType::File);
        assert_eq!(description.display_name, "book.pdf");
    }

    #[test]
    fn a_comic_without_pages_is_refused() {
        let result = describe("/books/empty.zip", &container(0, false, false));

        assert!(matches!(result, Err(Error::EmptyContainer(_))));
    }

    #[test]
    fn a_novel_without_image_entries_is_a_book() {
        let description = describe("/books/novel.epub", &container(0, false, true)).unwrap();

        assert_eq!(description.total_pages, 0);
        assert!(description.is_novel);
    }
}
