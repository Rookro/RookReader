use crate::error::Result;
use async_trait::async_trait;

use super::entity::Bookmark;

/// Defines the data access operations for the `Bookmark` aggregate.
#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait BookmarkRepository: Send + Sync {
    /// Creates a new bookmark for a book and returns its complete entity.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The unique identifier of the book to bookmark.
    /// * `name` - The display name of the new bookmark.
    /// * `page_index` - The comic page index, or the EPUB spine section index.
    /// * `cfi` - The position within an EPUB section, or `None` for comics.
    ///
    /// # Returns
    ///
    /// A `Result` containing the newly created `Bookmark` entity.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database insertion fails (e.g., the book does not exist).
    async fn create(
        &self,
        book_id: i64,
        name: &str,
        page_index: i64,
        cfi: Option<String>,
    ) -> Result<Bookmark>;

    /// Retrieves all bookmarks of a book, ordered by their position in the book.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The unique identifier of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `Bookmark` entities, empty if the book has none.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_by_book_id(&self, book_id: i64) -> Result<Vec<Bookmark>>;

    /// Renames an existing bookmark.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the bookmark to rename.
    /// * `name` - The new display name.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn rename(&self, id: i64, name: &str) -> Result<()>;

    /// Deletes a bookmark from the database.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the bookmark to delete.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn delete(&self, id: i64) -> Result<()>;
}
