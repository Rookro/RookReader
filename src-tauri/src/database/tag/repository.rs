use async_trait::async_trait;

use super::model::Tag;

/// Defines the data access operations for the `Tag` aggregate.
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
    async fn create(&self, name: &str, color_code: &str) -> Result<Tag, sqlx::Error>;

    /// Retrieves all tags from the database.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of `Tag` entities.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database query fails.
    async fn get_all(&self) -> Result<Vec<Tag>, sqlx::Error>;

    /// Deletes a tag from the database.
    ///
    /// # Arguments
    ///
    /// * `id` - The ID of the tag to delete.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the database execution fails.
    async fn delete(&self, id: i64) -> Result<(), sqlx::Error>;
}
