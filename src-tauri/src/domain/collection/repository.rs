use crate::domain::book::entity::BookWithState;
use crate::error::Result;
use async_trait::async_trait;

use super::entity::Collection;

/// Defines the data access operations for the `Collection` aggregate.
#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait CollectionRepository: Send + Sync {
    /// Creates a new collection and returns its complete entity.
    ///
    /// # Arguments
    ///
    /// * `name` - The display name of the new collection.
    /// * `icon_id` - The string identifier for the collection's icon.
    ///
    /// # Returns
    ///
    /// A `Result` containing the newly created `Collection` entity.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database insertion fails.
    async fn create(&self, name: &str, icon_id: &str) -> Result<Collection>;

    /// Retrieves all collections from the database.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `Collection` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_all(&self) -> Result<Vec<Collection>>;

    /// Retrieves all books contained within a specific collection, including their reading state.
    ///
    /// # Arguments
    ///
    /// * `collection_id` - The ID of the collection to filter by.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `BookWithState` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_books_by_collection(&self, collection_id: i64) -> Result<Vec<BookWithState>>;

    /// Adds a book to a specific collection.
    ///
    /// # Arguments
    ///
    /// * `collection_id` - The ID of the collection.
    /// * `book_id` - The ID of the book to add.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails (e.g., constraint violation).
    async fn add_book_to_collection(&self, collection_id: i64, book_id: i64) -> Result<()>;

    /// Removes a book from a specific collection.
    ///
    /// # Arguments
    ///
    /// * `collection_id` - The ID of the collection.
    /// * `book_id` - The ID of the book to remove.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn remove_book_from_collection(&self, collection_id: i64, book_id: i64) -> Result<()>;

    /// Retrieves the IDs of the collections that contain a book.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The ID of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing the collection IDs.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_collections_for_book(&self, book_id: i64) -> Result<Vec<i64>>;

    /// Replaces the collections that contain a book with the given ones.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The ID of the book.
    /// * `collection_ids` - The IDs of the collections that should contain the book.
    ///   Duplicated and nonexistent IDs are skipped.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn set_collections_for_book(&self, book_id: i64, collection_ids: &[i64]) -> Result<()>;

    /// Deletes a collection from the database.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the collection to delete.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn delete(&self, id: i64) -> Result<()>;
}
