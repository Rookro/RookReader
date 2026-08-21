use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::bookmark::entity::Bookmark;
use crate::domain::bookmark::repository::BookmarkRepository;
use crate::error::Result;

/// SQLite implementation of the `BookmarkRepository`.
pub struct SqliteBookmarkRepository {
    /// The connection pool for the SQLite database.
    pool: SqlitePool,
}

impl SqliteBookmarkRepository {
    /// Creates a new `SqliteBookmarkRepository` instance.
    ///
    /// # Arguments
    ///
    /// * `pool` - The `SqlitePool` to use for database connections.
    ///
    /// # Returns
    ///
    /// A new instance of `SqliteBookmarkRepository`.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookmarkRepository for SqliteBookmarkRepository {
    async fn create(
        &self,
        book_id: i64,
        name: &str,
        page_index: i64,
        cfi: Option<String>,
    ) -> Result<Bookmark> {
        let bookmark = sqlx::query_as!(
            Bookmark,
            r#"
            INSERT INTO bookmarks (book_id, name, page_index, cfi)
            VALUES (?, ?, ?, ?)
            RETURNING id, book_id, name, page_index, cfi, created_at
            "#,
            book_id,
            name,
            page_index,
            cfi
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(bookmark)
    }

    async fn get_by_book_id(&self, book_id: i64) -> Result<Vec<Bookmark>> {
        let bookmarks = sqlx::query_as!(
            Bookmark,
            r#"
            SELECT id, book_id, name, page_index, cfi, created_at
            FROM bookmarks
            WHERE book_id = ?
            ORDER BY page_index ASC, created_at ASC, id ASC
            "#,
            book_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(bookmarks)
    }

    async fn rename(&self, id: i64, name: &str) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE bookmarks
            SET name = ?
            WHERE id = ?
            "#,
            name,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn delete(&self, id: i64) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM bookmarks
            WHERE id = ?
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
