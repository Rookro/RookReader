use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::book::entity::{Book, BookWithState, Direction, ItemType, ReadingState};
use crate::domain::book::repository::BookRepository;
use crate::error::Result;
use crate::infrastructure::database::models::{BookRow, BookWithStateRow};

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

/// Inserts the book at `file_path`, or refreshes what was read from its container when it
/// is already registered. `created_at` is set only on insert.
async fn upsert_book<'e, E>(
    executor: E,
    file_path: &str,
    item_type: ItemType,
    display_name: &str,
    total_pages: i64,
    thumbnail_path: Option<String>,
    now: chrono::NaiveDateTime,
) -> Result<i64>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let item_type: &str = item_type.into();
    let book_id = sqlx::query!(
        r#"
        INSERT INTO books (file_path, item_type, display_name, total_pages, thumbnail_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
            display_name = excluded.display_name,
            total_pages = excluded.total_pages,
            thumbnail_path = excluded.thumbnail_path
        RETURNING id
        "#,
        file_path,
        item_type,
        display_name,
        total_pages,
        thumbnail_path,
        now
    )
    .fetch_one(executor)
    .await?
    .id;
    Ok(book_id)
}

#[async_trait]
impl BookRepository for SqliteBookRepository {
    async fn get_by_id(&self, id: i64) -> Result<Option<Book>> {
        let book = sqlx::query_as!(
            BookRow,
            r#"
            SELECT id, file_path, item_type, display_name, total_pages, series_id, series_order, thumbnail_path
            FROM books
            WHERE id = ?
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .map(Book::try_from)
        .transpose()?;

        Ok(book)
    }

    async fn get_book_with_state_by_id(&self, id: i64) -> Result<Option<BookWithState>> {
        let book = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                id, file_path, item_type, display_name, total_pages, series_id, series_order,
                thumbnail_path, created_at, is_spread_shifted, landscape_bits, reading_direction,
                last_read_page_index, last_opened_at,
                cfi as "cfi?: String",
                tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view
            WHERE id = ?
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .map(BookWithState::try_from)
        .transpose()?;

        Ok(book)
    }

    async fn register(
        &self,
        file_path: &str,
        item_type: ItemType,
        display_name: &str,
        total_pages: i64,
        thumbnail_path: Option<String>,
    ) -> Result<i64> {
        upsert_book(
            &self.pool,
            file_path,
            item_type,
            display_name,
            total_pages,
            thumbnail_path,
            chrono::Utc::now().naive_utc(),
        )
        .await
    }

    async fn record_opened(
        &self,
        file_path: &str,
        item_type: ItemType,
        display_name: &str,
        total_pages: i64,
        thumbnail_path: Option<String>,
    ) -> Result<i64> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().naive_utc();
        let book_id = upsert_book(
            &mut *tx,
            file_path,
            item_type,
            display_name,
            total_pages,
            thumbnail_path,
            now,
        )
        .await?;

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

    async fn update_spread_shift(&self, book_id: i64, is_spread_shifted: bool) -> Result<()> {
        sqlx::query!(
            "UPDATE books SET is_spread_shifted = ? WHERE id = ?",
            is_spread_shifted,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_reading_direction(
        &self,
        book_id: i64,
        reading_direction: Direction,
    ) -> Result<()> {
        let reading_direction: &str = reading_direction.into();
        sqlx::query!(
            "UPDATE books SET reading_direction = ? WHERE id = ?",
            reading_direction,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_page_layout(&self, book_id: i64, landscape_bits: &str) -> Result<()> {
        sqlx::query!(
            "UPDATE books SET landscape_bits = ? WHERE id = ?",
            landscape_bits,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update_reading_progress(&self, state: &ReadingState) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO reading_state (book_id, last_read_page_index, cfi, last_opened_at)
            VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            ON CONFLICT(book_id) DO UPDATE SET
                last_read_page_index = excluded.last_read_page_index,
                cfi = excluded.cfi,
                last_opened_at = COALESCE(excluded.last_opened_at, reading_state.last_opened_at)
            "#,
            state.book_id,
            state.last_read_page_index,
            state.cfi,
            state.last_opened_at
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_recently_read_books(&self) -> Result<Vec<BookWithState>> {
        let books = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                id, file_path, item_type, display_name, total_pages, series_id, series_order,
                thumbnail_path, created_at, is_spread_shifted, landscape_bits, reading_direction,
                last_read_page_index, last_opened_at,
                cfi as "cfi?: String",
                tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view
            WHERE last_opened_at IS NOT NULL
            ORDER BY last_opened_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(BookWithState::try_from)
        .collect::<Result<Vec<_>>>()?;
        Ok(books)
    }

    async fn get_all_books_with_state(&self) -> Result<Vec<BookWithState>> {
        let books = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                id, file_path, item_type, display_name, total_pages, series_id, series_order,
                thumbnail_path, created_at, is_spread_shifted, landscape_bits, reading_direction,
                last_read_page_index, last_opened_at,
                cfi as "cfi?: String",
                tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view
            ORDER BY id DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(BookWithState::try_from)
        .collect::<Result<Vec<_>>>()?;
        Ok(books)
    }

    async fn delete(&self, id: i64) -> Result<()> {
        // reading_state, book_tags, collection_items and bookmarks all declare
        // ON DELETE CASCADE, and sqlx enables foreign keys on every connection.
        sqlx::query!(
            r#"
            DELETE FROM books WHERE id = ?
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
