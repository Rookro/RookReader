use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::book::entity::BookWithState;
use crate::domain::tag::entity::Tag;
use crate::domain::tag::repository::TagRepository;
use crate::error::Result;
use crate::infrastructure::database::models::BookWithStateRow;

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
    async fn create(&self, name: &str, color_code: &str) -> Result<Tag> {
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

    async fn get_all(&self) -> Result<Vec<Tag>> {
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

    async fn attach_tags_to_book(&self, book_id: i64, tag_ids: &[i64]) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query!(
            r#"
            DELETE FROM book_tags WHERE book_id = ?
            "#,
            book_id
        )
        .execute(&mut *tx)
        .await?;

        for tag_id in tag_ids {
            // SELECT from `tags` so a stale tag_id (no matching row) is skipped instead of
            // raising a FOREIGN KEY error, which OR IGNORE does not suppress. OR IGNORE
            // still dedupes against the (book_id, tag_id) primary key.
            sqlx::query!(
                r#"
                INSERT OR IGNORE INTO book_tags (book_id, tag_id)
                SELECT ?, id FROM tags WHERE id = ?
                "#,
                book_id,
                tag_id
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn get_tags_for_book(&self, book_id: i64) -> Result<Vec<i64>> {
        let records = sqlx::query!(
            r#"
            SELECT tag_id FROM book_tags WHERE book_id = ?
            "#,
            book_id
        )
        .fetch_all(&self.pool)
        .await?;

        let tag_ids = records.into_iter().map(|r| r.tag_id).collect();
        Ok(tag_ids)
    }

    async fn get_books_by_tag(&self, tag_id: i64) -> Result<Vec<BookWithState>> {
        let books = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                v.id, v.file_path, v.item_type, v.display_name, v.total_pages, v.series_id, v.series_order,
                v.thumbnail_path, v.created_at, v.last_read_page_index, v.last_opened_at,
                v.tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view v
            INNER JOIN book_tags bt ON v.id = bt.book_id
            WHERE bt.tag_id = ?
            ORDER BY v.display_name ASC
            "#,
            tag_id
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(BookWithState::from)
        .collect();
        Ok(books)
    }

    async fn delete(&self, id: i64) -> Result<()> {
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
