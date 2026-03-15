use async_trait::async_trait;
use sqlx::SqlitePool;

use super::model::Bookshelf;
use super::repository::BookshelfRepository;

/// SQLite implementation of the `BookshelfRepository`.
pub struct SqliteBookshelfRepository {
    /// The connection pool for the SQLite database.
    pool: SqlitePool,
}

impl SqliteBookshelfRepository {
    /// Creates a new `SqliteBookshelfRepository` instance.
    ///
    /// # Arguments
    ///
    /// * `pool` - The `SqlitePool` to use for database connections.
    ///
    /// # Returns
    ///
    /// A new instance of `SqliteBookshelfRepository`.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookshelfRepository for SqliteBookshelfRepository {
    async fn create(&self, name: &str, icon_id: &str) -> Result<Bookshelf, sqlx::Error> {
        let bookshelf = sqlx::query_as!(
            Bookshelf,
            r#"
            INSERT INTO bookshelves (name, icon_id)
            VALUES (?, ?)
            RETURNING id, name, icon_id, created_at
            "#,
            name,
            icon_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(bookshelf)
    }

    async fn get_all(&self) -> Result<Vec<Bookshelf>, sqlx::Error> {
        let bookshelves = sqlx::query_as!(
            Bookshelf,
            r#"
            SELECT id, name, icon_id, created_at
            FROM bookshelves
            ORDER BY id ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(bookshelves)
    }

    async fn add_book_to_bookshelf(
        &self,
        bookshelf_id: i64,
        book_id: i64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            INSERT INTO bookshelf_items (bookshelf_id, book_id)
            VALUES (?, ?)
            "#,
            bookshelf_id,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn remove_book_from_bookshelf(
        &self,
        bookshelf_id: i64,
        book_id: i64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            DELETE FROM bookshelf_items
            WHERE bookshelf_id = ? AND book_id = ?
            "#,
            bookshelf_id,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn delete(&self, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query!(
            r#"
            DELETE FROM bookshelves
            WHERE id = ?
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
