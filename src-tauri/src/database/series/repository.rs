use async_trait::async_trait;

use super::model::Series;

/// Defines the data access operations for the `Series` aggregate.
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
}
