use async_trait::async_trait;
use sqlx::SqlitePool;

use super::model::Series;
use super::repository::SeriesRepository;

/// SQLite implementation of the `SeriesRepository`.
pub struct SqliteSeriesRepository {
    /// The connection pool for the SQLite database.
    pool: SqlitePool,
}

impl SqliteSeriesRepository {
    /// Creates a new `SqliteSeriesRepository` instance.
    ///
    /// # Arguments
    ///
    /// * `pool` - The `SqlitePool` to use for database connections.
    ///
    /// # Returns
    ///
    /// A new instance of `SqliteSeriesRepository`.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SeriesRepository for SqliteSeriesRepository {
    async fn create(&self, name: &str) -> Result<i64, sqlx::Error> {
        let id = sqlx::query!(
            r#"
            INSERT INTO series (name)
            VALUES (?)
            RETURNING id
            "#,
            name
        )
        .fetch_one(&self.pool)
        .await?
        .id;

        Ok(id)
    }

    async fn get_all(&self) -> Result<Vec<Series>, sqlx::Error> {
        let series_list = sqlx::query_as!(
            Series,
            r#"
            SELECT id, name
            FROM series
            ORDER BY id ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(series_list)
    }
}
