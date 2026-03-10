use async_trait::async_trait;

use super::model::Bookshelf;

/// Defines the data access operations for the `Bookshelf` aggregate.
#[async_trait]
pub trait BookshelfRepository: Send + Sync {
    /// Creates a new bookshelf and returns its complete entity.
    ///
    /// # Arguments
    ///
    /// * `name` - The display name of the new bookshelf.
    /// * `icon_id` - The string identifier for the bookshelf's icon.
    ///
    /// # Returns
    ///
    /// A `Result` containing the newly created `Bookshelf` entity.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database insertion fails.
    async fn create(&self, name: &str, icon_id: &str) -> Result<Bookshelf, sqlx::Error>;

    /// Retrieves all bookshelves from the database.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `Bookshelf` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_all(&self) -> Result<Vec<Bookshelf>, sqlx::Error>;

    /// Adds a book to a specific bookshelf.
    ///
    /// # Arguments
    ///
    /// * `bookshelf_id` - The ID of the bookshelf.
    /// * `book_id` - The ID of the book to add.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails (e.g., constraint violation).
    async fn add_book_to_bookshelf(
        &self,
        bookshelf_id: i64,
        book_id: i64,
    ) -> Result<(), sqlx::Error>;

    /// Removes a book from a specific bookshelf.
    ///
    /// # Arguments
    ///
    /// * `bookshelf_id` - The ID of the bookshelf.
    /// * `book_id` - The ID of the book to remove.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn remove_book_from_bookshelf(
        &self,
        bookshelf_id: i64,
        book_id: i64,
    ) -> Result<(), sqlx::Error>;

    /// Deletes a bookshelf from the database.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the bookshelf to delete.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn delete(&self, id: i64) -> Result<(), sqlx::Error>;
}
