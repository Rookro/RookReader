use async_trait::async_trait;

use super::model::Series;

/// Defines the data access operations for the `Series` aggregate.
#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait SeriesRepository: Send + Sync {
    /// Creates a new series.
    ///
    /// # Arguments
    ///
    /// * `name` - The name of the new series. Must be unique.
    ///
    /// # Returns
    ///
    /// A `Result` containing the ID of the newly created series.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database insertion fails (e.g., UNIQUE constraint violation).
    async fn create(&self, name: &str) -> Result<i64, sqlx::Error>;

    /// Retrieves all series from the database.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `Series` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_all(&self) -> Result<Vec<Series>, sqlx::Error>;

    /// Updates the series associated with a specific book.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The unique identifier of the book.
    /// * `series_id` - The unique identifier of the series to associate with the book, or `None` to remove.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn assign_book_to_series(
        &self,
        book_id: i64,
        series_id: Option<i64>,
    ) -> Result<(), sqlx::Error>;

    /// Updates the `series_order` for a given list of book IDs.
    /// The order is determined by the index of the book ID in the list (1-based).
    ///
    /// # Arguments
    ///
    /// * `book_ids` - A list of book IDs in the desired order.
    ///
    /// # Returns
    ///
    /// A `Result` indicating the success of the operation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn update_book_orders_in_series(&self, book_ids: Vec<i64>) -> Result<(), sqlx::Error>;

    /// Deletes a series by its ID.
    /// Books associated with this series will have their series_id set to NULL due to FK constraints.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the series to delete.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database deletion fails.
    async fn delete(&self, id: i64) -> Result<(), sqlx::Error>;
}
