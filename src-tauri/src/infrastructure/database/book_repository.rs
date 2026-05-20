use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::book::entity::{Book, BookWithState, ReadBook, ReadingState};
use crate::domain::book::repository::BookRepository;
use crate::error::Result;
use crate::infrastructure::database::models::BookWithStateRow;

/// SQLite implementation of the `BookRepository`.
pub struct SqliteBookRepository {
    /// The connection pool for the SQLite database.
    pool: SqlitePool,
}

impl SqliteBookRepository {
    /// Creates a new `SqliteBookRepository` instance.
    ///
    /// # Arguments
    ///
    /// * `pool` - The `SqlitePool` to use for database connections.
    ///
    /// # Returns
    ///
    /// A new instance of `SqliteBookRepository`.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookRepository for SqliteBookRepository {
    async fn get_by_id(&self, id: i64) -> Result<Option<Book>> {
        let book = sqlx::query_as!(
            Book,
            r#"
            SELECT id, file_path, item_type, display_name, total_pages, series_id, series_order, thumbnail_path
            FROM books
            WHERE id = ?
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(book)
    }

    async fn get_by_path(&self, file_path: &str) -> Result<Option<Book>> {
        let book = sqlx::query_as!(
            Book,
            r#"
            SELECT
                id,
                file_path,
                item_type,
                display_name,
                total_pages,
                series_id,
                series_order,
                thumbnail_path
            FROM
                books
            WHERE
                file_path = ?
            "#,
            file_path
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(book)
    }

    async fn get_book_with_state_by_id(&self, id: i64) -> Result<Option<BookWithState>> {
        let book = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                id, file_path, item_type, display_name, total_pages, series_id, series_order,
                thumbnail_path, last_read_page_index, last_opened_at,
                tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view
            WHERE id = ?
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .map(BookWithState::from);

        Ok(book)
    }

    async fn upsert_book(
        &self,
        file_path: &str,
        item_type: &str,
        display_name: &str,
        total_pages: i64,
        thumbnail_path: Option<String>,
    ) -> Result<i64> {
        let book_id = sqlx::query!(
            r#"
            INSERT INTO books (file_path, item_type, display_name, total_pages, thumbnail_path)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(file_path) DO UPDATE SET
                -- Use ON CONFLICT DO UPDATE SET id = id to always return the ID.
                file_path = excluded.file_path,
                thumbnail_path = excluded.thumbnail_path
            RETURNING id
            "#,
            file_path,
            item_type,
            display_name,
            total_pages,
            thumbnail_path
        )
        .fetch_one(&self.pool)
        .await?
        .id;

        Ok(book_id)
    }

    async fn upsert_read_book(
        &self,
        file_path: &str,
        item_type: &str,
        display_name: &str,
        total_pages: i64,
        thumbnail_path: Option<String>,
    ) -> Result<i64> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().naive_utc();
        let book_id = sqlx::query!(
            r#"
            INSERT INTO books (file_path, item_type, display_name, total_pages, thumbnail_path)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(file_path) DO UPDATE SET
                -- Use ON CONFLICT DO UPDATE SET id = id to always return the ID.
                file_path = excluded.file_path,
                thumbnail_path = excluded.thumbnail_path
            RETURNING id
            "#,
            file_path,
            item_type,
            display_name,
            total_pages,
            thumbnail_path
        )
        .fetch_one(&mut *tx)
        .await?
        .id;

        sqlx::query!(
            r#"
            INSERT INTO reading_state (book_id, last_read_page_index, last_opened_at)
            VALUES (?, 0, ?)
            ON CONFLICT(book_id) DO UPDATE SET
                last_opened_at = excluded.last_opened_at
            "#,
            book_id,
            now
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(book_id)
    }

    async fn clear_reading_history(&self, book_id: i64) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM reading_state
            WHERE book_id = ?
            "#,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn clear_all_reading_history(&self) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM reading_state
            "#
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_reading_state(&self, state: &ReadingState) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO reading_state (book_id, last_read_page_index, last_opened_at)
            VALUES (?, ?, ?)
            ON CONFLICT(book_id) DO UPDATE SET
                last_read_page_index = excluded.last_read_page_index,
                last_opened_at = excluded.last_opened_at
            "#,
            state.book_id,
            state.last_read_page_index,
            state.last_opened_at
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_recently_read_books(&self, limit: Option<i64>) -> Result<Vec<ReadBook>> {
        let books = match limit {
            Some(limit) => {
                sqlx::query_as!(
                    ReadBook,
                    r#"
                    SELECT
                        b.id, b.file_path, b.item_type, b.display_name, b.total_pages,
                        b.series_id, b.series_order, b.thumbnail_path, r.last_read_page_index,
                        r.last_opened_at as "last_opened_at!"
                    FROM books b
                    INNER JOIN reading_state r ON b.id = r.book_id
                    WHERE r.last_opened_at IS NOT NULL
                    ORDER BY r.last_opened_at DESC
                    LIMIT ?
                    "#,
                    limit
                )
                .fetch_all(&self.pool)
                .await?
            }
            None => {
                sqlx::query_as!(
                    ReadBook,
                    r#"
                    SELECT
                        b.id, b.file_path, b.item_type, b.display_name, b.total_pages,
                        b.series_id, b.series_order, b.thumbnail_path, r.last_read_page_index,
                        r.last_opened_at as "last_opened_at!"
                    FROM books b
                    INNER JOIN reading_state r ON b.id = r.book_id
                    WHERE r.last_opened_at IS NOT NULL
                    ORDER BY r.last_opened_at DESC
                    "#
                )
                .fetch_all(&self.pool)
                .await?
            }
        };

        Ok(books)
    }

    async fn get_all_books_with_state(&self) -> Result<Vec<BookWithState>> {
        let books = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                id, file_path, item_type, display_name, total_pages, series_id, series_order,
                thumbnail_path, last_read_page_index, last_opened_at,
                tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view
            ORDER BY id DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(BookWithState::from)
        .collect();
        Ok(books)
    }

    async fn delete_book(&self, id: i64) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query!(
            r#"
            DELETE FROM reading_state WHERE book_id = ?
            "#,
            id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            DELETE FROM book_tags WHERE book_id = ?
            "#,
            id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            DELETE FROM bookshelf_items WHERE book_id = ?
            "#,
            id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            DELETE FROM books WHERE id = ?
            "#,
            id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }
}
