use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::book::entity::BookWithState;

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

    async fn get_books_by_series(&self, series_id: i64) -> Result<Vec<BookWithState>, sqlx::Error> {
        let books = sqlx::query_as!(
                BookWithState,
                r#"
                SELECT b.id, b.file_path, b.item_type, b.display_name, b.total_pages, b.series_id, b.series_order,
                       b.thumbnail_path, r.last_read_page_index, r.last_opened_at,
                       (SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) as "tag_ids_str?: String"
                FROM books b
                LEFT JOIN reading_state r ON b.id = r.book_id
                WHERE b.series_id = ?
                ORDER BY b.series_order ASC, b.display_name ASC
                "#,
                series_id
            )
            .fetch_all(&self.pool)
            .await?;
        Ok(books)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::book::repository::BookRepository;
    use crate::infrastructure::database::book_repository::SqliteBookRepository;

    async fn setup_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_get_all() {
        let pool = setup_db().await;
        let repo = SqliteSeriesRepository::new(pool);

        let id = repo.create("Test Series").await.unwrap();
        let all = repo.get_all().await.unwrap();

        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, id);
        assert_eq!(all[0].name, "Test Series");
    }

    #[tokio::test]
    async fn test_assign_book_to_series() {
        let pool = setup_db().await;
        let repo = SqliteSeriesRepository::new(pool.clone());
        let book_repo = SqliteBookRepository::new(pool);

        let series_id = repo.create("Series").await.unwrap();
        let book_id = book_repo
            .upsert_book("path", "file", "Book", 10, None)
            .await
            .unwrap();

        repo.assign_book_to_series(book_id, Some(series_id))
            .await
            .unwrap();
        let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
        assert_eq!(book.series_id, Some(series_id));

        repo.assign_book_to_series(book_id, None).await.unwrap();
        let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
        assert_eq!(book.series_id, None);
    }

    #[tokio::test]
    async fn test_update_book_orders_in_series() {
        let pool = setup_db().await;
        let repo = SqliteSeriesRepository::new(pool.clone());
        let book_repo = SqliteBookRepository::new(pool);

        let b1 = book_repo
            .upsert_book("p1", "file", "B1", 10, None)
            .await
            .unwrap();
        let b2 = book_repo
            .upsert_book("p2", "file", "B2", 10, None)
            .await
            .unwrap();

        repo.update_book_orders_in_series(vec![b2, b1])
            .await
            .unwrap();

        let book2 = book_repo.get_by_id(b2).await.unwrap().unwrap();
        let book1 = book_repo.get_by_id(b1).await.unwrap().unwrap();

        assert_eq!(book2.series_order, Some(1));
        assert_eq!(book1.series_order, Some(2));
    }

    #[tokio::test]
    async fn test_delete_series() {
        let pool = setup_db().await;
        let repo = SqliteSeriesRepository::new(pool);

        let id = repo.create("To Delete").await.unwrap();
        repo.delete(id).await.unwrap();

        let all = repo.get_all().await.unwrap();
        assert!(all.is_empty());
    }
}
