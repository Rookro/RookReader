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
            SELECT id, name, created_at
            FROM series
            ORDER BY id ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(series_list)
    }

    async fn assign_book_to_series(
        &self,
        book_id: i64,
        series_id: Option<i64>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            UPDATE books
            SET series_id = ?
            WHERE id = ?
            "#,
            series_id,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_book_orders_in_series(&self, book_ids: Vec<i64>) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        for (index, &book_id) in book_ids.iter().enumerate() {
            let order = (index + 1) as i64;
            sqlx::query!(
                r#"
                UPDATE books
                SET series_order = ?
                WHERE id = ?
                "#,
                order,
                book_id
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    async fn delete(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            DELETE FROM series
            WHERE id = ?
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
