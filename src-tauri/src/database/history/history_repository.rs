use async_trait::async_trait;

use crate::database::history::models::HistoryEntry;
use crate::error::Result;

/// A trait defining the operations for managing the reading history.
#[async_trait]
pub trait HistoryRepository: Send + Sync {
    /// Inserts or updates a history entry for a given path.
    ///
    /// # Arguments
    ///
    /// * `path` - The file path or identifier for the history item.
    /// * `item_type` - The type of the item (e.g., "file", "directory", "container").
    /// * `page_index` - The optional page index the user was viewing.
    ///
    /// # Returns
    ///
    /// A `Result` indicating success (`Ok(())`) or an error (`Err`).
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if the database operation fails.
    async fn upsert(&self, path: &str, item_type: &str, page_index: Option<i64>) -> Result<()>;

    /// Retrieves all history entries.
    ///
    /// # Returns
    ///
    /// A `Result` which is `Ok` with a `Vec<HistoryEntry>` containing all history records.
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if the database query fails.
    async fn get_all(&self) -> Result<Vec<HistoryEntry>>;

    /// Retrieves the most recently accessed history entry.
    ///
    /// # Returns
    ///
    /// A `Result` which is `Ok` with an `Option<HistoryEntry>`. It will be `Some` if an entry exists, or `None` if the history is empty.
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if the database query fails.
    async fn get_latest(&self) -> Result<Option<HistoryEntry>>;

    /// Retrieves a specific history entry by its path.
    ///
    /// # Arguments
    ///
    /// * `path` - The path of the history entry to retrieve.
    ///
    /// # Returns
    ///
    /// A `Result` which is `Ok` with an `Option<HistoryEntry>`. It will be `Some` if an entry is found for the given path, or `None` if it does not exist.
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if the database query fails.
    async fn get(&self, path: &str) -> Result<Option<HistoryEntry>>;

    /// Deletes a specific history entry by its ID.
    ///
    /// # Arguments
    ///
    /// * `id` - The unique identifier of the history entry to delete.
    ///
    /// # Returns
    ///
    /// A `Result` indicating success (`Ok(())`) or an error (`Err`).
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if the database deletion fails.
    async fn delete(&self, id: i64) -> Result<()>;

    /// Deletes all history entries from the database.
    ///
    /// # Returns
    ///
    /// A `Result` indicating success (`Ok(())`) or an error (`Err`).
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if the database deletion fails.
    async fn delete_all(&self) -> Result<()>;
}
