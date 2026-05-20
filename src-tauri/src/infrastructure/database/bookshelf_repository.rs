use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::book::entity::BookWithState;
use crate::domain::bookshelf::entity::Bookshelf;
use crate::domain::bookshelf::repository::BookshelfRepository;
use crate::error::Result;

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
    async fn create(&self, name: &str, icon_id: &str) -> Result<Bookshelf> {
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

    async fn get_all(&self) -> Result<Vec<Bookshelf>> {
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

    async fn get_books_by_bookshelf(&self, bookshelf_id: i64) -> Result<Vec<BookWithState>> {
        let rows = sqlx::query!(
            r#"
            SELECT b.id, b.file_path, b.item_type, b.display_name, b.total_pages, b.series_id, b.series_order,
                   b.thumbnail_path, r.last_read_page_index as "last_read_page_index?", r.last_opened_at as "last_opened_at?",
                   (SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) as "tag_ids_str?: String"
            FROM books b
            INNER JOIN bookshelf_items bi ON b.id = bi.book_id
            LEFT JOIN reading_state r ON b.id = r.book_id
            WHERE bi.bookshelf_id = ?
            ORDER BY bi.added_at DESC
            "#,
            bookshelf_id
        )
        .fetch_all(&self.pool)
        .await?;

        let books = rows
            .into_iter()
            .map(|r| {
                let mut b = BookWithState {
                    id: r.id,
                    file_path: r.file_path,
                    item_type: r.item_type,
                    display_name: r.display_name,
                    total_pages: r.total_pages,
                    series_id: r.series_id,
                    series_order: r.series_order,
                    thumbnail_path: r.thumbnail_path,
                    last_read_page_index: r.last_read_page_index,
                    last_opened_at: r.last_opened_at,
                    tag_ids_str: r.tag_ids_str,
                    tag_ids: Vec::new(),
                };
                b.fill_tag_ids();
                b
            })
            .collect();

        Ok(books)
    }

    async fn add_book_to_bookshelf(&self, bookshelf_id: i64, book_id: i64) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT OR IGNORE INTO bookshelf_items (bookshelf_id, book_id)
            VALUES (?, ?)
            "#,
            bookshelf_id,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn remove_book_from_bookshelf(&self, bookshelf_id: i64, book_id: i64) -> Result<()> {
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

    async fn delete(&self, id: i64) -> Result<()> {
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
