use async_trait::async_trait;

use crate::database::book::{BookWithState, ReadBook};

use super::model::{Book, ReadingState};

/// Defines the data access operations for the `Book` aggregate.
#[async_trait]
pub trait BookRepository: Send + Sync {
    /// Retrieves a book by its unique ID.
    ///
    /// # Arguments
    ///
    /// * `id` - The unique identifier of the book to retrieve.
    ///
    /// # Returns
    ///
    /// A `Result` containing an `Option<Book>`. Returns `Some(Book)` if found, or `None` if not.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if a database operation fails.
    async fn get_by_id(&self, id: i64) -> Result<Option<Book>, sqlx::Error>;

    /// Retrieves a book by its unique file path.
    ///
    /// # Arguments
    ///
    /// * `file_path` - The unique file or directory path of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing an `Option<Book>`. Returns `Some(Book)` if found, or `None` if not.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if a database operation fails.
    async fn get_by_path(&self, file_path: &str) -> Result<Option<Book>, sqlx::Error>;

    /// Retrieves a book along with its reading state by its unique ID.
    ///
    /// The reading state fields will be `None` if the book has never been opened.
    ///
    /// # Arguments
    ///
    /// * `id` - The unique identifier of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing an `Option<BookWithState>`.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_book_with_state_by_id(
        &self,
        id: i64,
    ) -> Result<Option<BookWithState>, sqlx::Error>;

    /// Registers a book or returns its ID if it already exists, without updating reading state.
    ///
    /// # Arguments
    ///
    /// * `file_path` - The unique file or directory path.
    /// * `item_type` - The type of the item ('file' or 'directory').
    /// * `display_name` - The display name of the book.
    /// * `total_pages` - The total number of pages.
    /// * `thumbnail_path` - The path to the thumbnail image of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing the ID of the book.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database transaction fails.
    async fn upsert_book(
        &self,
        file_path: &str,
        item_type: &str,
        display_name: &str,
        total_pages: i64,
        thumbnail_path: Option<String>,
    ) -> Result<i64, sqlx::Error>;

    /// Registers a book when opened, or updates its last opened time if it already exists.
    ///
    /// If the book is new, it is inserted into the `books` table with no tags or bookshelves,
    /// and a new `reading_state` is created with `last_read_page_index` set to 0.
    /// If the book already exists, only the `last_opened_at` timestamp in `reading_state` is updated.
    ///
    /// # Arguments
    ///
    /// * `file_path` - The unique file or directory path.
    /// * `item_type` - The type of the item ('file' or 'directory').
    /// * `display_name` - The display name of the book.
    /// * `total_pages` - The total number of pages.
    /// * `thumbnail_path` - The path to the thumbnail image of the book.
    ///
    /// # Returns
    ///
    /// A `Result` containing the ID of the book.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database transaction fails.
    async fn upsert_read_book(
        &self,
        file_path: &str,
        item_type: &str,
        display_name: &str,
        total_pages: i64,
        thumbnail_path: Option<String>,
    ) -> Result<i64, sqlx::Error>;

    /// Clears the reading history for a specific book.
    ///
    /// This removes the reading state entry entirely, which effectively resets
    /// the progress and last opened timestamp to `None` (unread state).
    ///
    /// # Arguments
    ///
    /// * `book_id` - The unique identifier of the book.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn clear_reading_history(&self, book_id: i64) -> Result<(), sqlx::Error>;

    /// Clears the reading history for all books.
    ///
    /// This removes all entries from the `reading_state` table, effectively resetting
    /// the progress and last opened timestamp to `None` (unread state) for the entire library.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn clear_all_reading_history(&self) -> Result<(), sqlx::Error>;

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
    async fn update_book_tags(&self, book_id: i64, tag_ids: &[i64]) -> Result<(), sqlx::Error>;

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
    async fn get_book_tags(&self, book_id: i64) -> Result<Vec<i64>, sqlx::Error>;

    /// Updates or inserts the reading state for a book.
    ///
    /// # Arguments
    ///
    /// * `state` - The `ReadingState` to upsert.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn upsert_reading_state(&self, state: &ReadingState) -> Result<(), sqlx::Error>;

    /// Retrieves books that have been opened, ordered by the last opened time in descending order.
    ///
    /// # Arguments
    ///
    /// * `limit` - The maximum number of books to return.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `ReadBook` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_recently_read_books(
        &self,
        limit: Option<i64>,
    ) -> Result<Vec<ReadBook>, sqlx::Error>;

    /// Retrieves all books along with their reading state.
    ///
    /// # Returns
    ///
    /// A `Result` containing a `Vec<BookWithState>`.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_all_books_with_state(&self) -> Result<Vec<BookWithState>, sqlx::Error>;

    /// Retrieves all books contained within a specific bookshelf, including their reading state.
    ///
    /// # Arguments
    ///
    /// * `bookshelf_id` - The ID of the bookshelf to filter by.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `BookWithState` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_books_with_state_by_bookshelf_id(
        &self,
        bookshelf_id: i64,
    ) -> Result<Vec<BookWithState>, sqlx::Error>;

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
    async fn get_books_with_state_by_tag_id(
        &self,
        tag_id: i64,
    ) -> Result<Vec<BookWithState>, sqlx::Error>;

    /// Retrieves all books belonging to a specific series, including their reading state.
    ///
    /// # Arguments
    ///
    /// * `series_id` - The ID of the series to filter by.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `BookWithState` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_books_with_state_by_series_id(
        &self,
        series_id: i64,
    ) -> Result<Vec<BookWithState>, sqlx::Error>;

    /// Deletes a book by its unique ID.
    ///
    /// # Arguments
    ///
    /// * `id` - The unique identifier of the book to delete.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if a database operation fails.
    async fn delete_book(&self, id: i64) -> Result<(), sqlx::Error>;
}
