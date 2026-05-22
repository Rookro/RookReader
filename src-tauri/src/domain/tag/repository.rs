use crate::domain::book::entity::BookWithState;
use crate::error::Result;
use async_trait::async_trait;

use super::entity::Tag;

/// Defines the data access operations for the `Tag` aggregate.
#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait TagRepository: Send + Sync {
    /// Creates a new tag and returns its complete entity.
    ///
    /// # Arguments
    ///
    /// * `name` - The display name of the new tag.
    /// * `color_code` - The color code for the tag (e.g., "#FF5733").
    ///
    /// # Returns
    ///
    /// A `Result` containing the newly created `Tag` entity.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database insertion fails (e.g., name already exists).
    async fn create(&self, name: &str, color_code: &str) -> Result<Tag>;

    /// Retrieves all tags from the database.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `Tag` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_all(&self) -> Result<Vec<Tag>>;

    /// Updates the tags associated with a specific book.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The unique identifier of the book.
    /// * `tag_ids` - A slice of tag IDs to associate with the book.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn attach_tags_to_book(&self, book_id: i64, tag_ids: &[i64]) -> Result<()>;

    /// Retrieves the IDs of all tags associated with a specific book.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The unique identifier of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of tag IDs.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_tags_for_book(&self, book_id: i64) -> Result<Vec<i64>>;

    /// Retrieves all books associated with a specific tag, including their reading state.
    ///
    /// # Arguments
    ///
    /// * `tag_id` - The ID of the tag to filter by.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `BookWithState` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_books_by_tag(&self, tag_id: i64) -> Result<Vec<BookWithState>>;

    /// Deletes a tag from the database.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the tag to delete.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn delete(&self, id: i64) -> Result<()>;
}
