use async_trait::async_trait;
use sqlx::SqlitePool;

use super::model::Tag;
use super::repository::TagRepository;

/// SQLite implementation of the `TagRepository`.
pub struct SqliteTagRepository {
    /// The connection pool for the SQLite database.
    pool: SqlitePool,
}

impl SqliteTagRepository {
    /// Creates a new `SqliteTagRepository` instance.
    ///
    /// # Arguments
    ///
    /// * `pool` - The `SqlitePool` to use for database connections.
    ///
    /// # Returns
    ///
    /// A new instance of `SqliteTagRepository`.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TagRepository for SqliteTagRepository {
    async fn create(&self, name: &str, color_code: &str) -> Result<Tag, sqlx::Error> {
        let tag = sqlx::query_as!(
            Tag,
            r#"
            INSERT INTO tags (name, color_code)
            VALUES (?, ?)
            RETURNING id, name, color_code
            "#,
            name,
            color_code
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(tag)
    }

    async fn get_all(&self) -> Result<Vec<Tag>, sqlx::Error> {
        let tags = sqlx::query_as!(
            Tag,
            r#"
            SELECT id, name, color_code
            FROM tags
            ORDER BY id ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(tags)
    }

    async fn delete(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            DELETE FROM tags
            WHERE id = ?
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
