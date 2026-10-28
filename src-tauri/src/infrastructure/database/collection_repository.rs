use async_trait::async_trait;
use sqlx::SqlitePool;

use crate::domain::book::entity::BookWithState;
use crate::domain::collection::entity::Collection;
use crate::domain::collection::repository::CollectionRepository;
use crate::error::Result;
use crate::infrastructure::database::models::BookWithStateRow;

/// SQLite implementation of the `CollectionRepository`.
pub struct SqliteCollectionRepository {
    /// The connection pool for the SQLite database.
    pool: SqlitePool,
}

impl SqliteCollectionRepository {
    /// Creates a new `SqliteCollectionRepository` instance.
    ///
    /// # Arguments
    ///
    /// * `pool` - The `SqlitePool` to use for database connections.
    ///
    /// # Returns
    ///
    /// A new instance of `SqliteCollectionRepository`.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CollectionRepository for SqliteCollectionRepository {
    async fn create(&self, name: &str, icon_id: &str) -> Result<Collection> {
        let collection = sqlx::query_as!(
            Collection,
            r#"
            INSERT INTO collections (name, icon_id)
            VALUES (?, ?)
            RETURNING id, name, icon_id, created_at
            "#,
            name,
            icon_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(collection)
    }

    async fn get_all(&self) -> Result<Vec<Collection>> {
        let collections = sqlx::query_as!(
            Collection,
            r#"
            SELECT id, name, icon_id, created_at
            FROM collections
            ORDER BY id ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(collections)
    }

    async fn get_books_by_collection(&self, collection_id: i64) -> Result<Vec<BookWithState>> {
        let books = sqlx::query_as!(
            BookWithStateRow,
            r#"
            SELECT
                v.id, v.file_path, v.item_type, v.display_name, v.total_pages, v.series_id, v.series_order,
                v.thumbnail_path, v.created_at, v.is_spread_shifted, v.landscape_bits, v.reading_direction,
                v.last_read_page_index, v.last_opened_at,
                v.cfi as "cfi?: String",
                v.tag_ids_str as "tag_ids_str?: String"
            FROM book_with_state_view v
            INNER JOIN collection_items ci ON v.id = ci.book_id
            WHERE ci.collection_id = ?
            ORDER BY ci.added_at DESC
            "#,
            collection_id
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(BookWithState::try_from)
        .collect::<Result<Vec<_>>>()?;
        Ok(books)
    }

    async fn add_book_to_collection(&self, collection_id: i64, book_id: i64) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT OR IGNORE INTO collection_items (collection_id, book_id)
            VALUES (?, ?)
            "#,
            collection_id,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn remove_book_from_collection(&self, collection_id: i64, book_id: i64) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM collection_items
            WHERE collection_id = ? AND book_id = ?
            "#,
            collection_id,
            book_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_collections_for_book(&self, book_id: i64) -> Result<Vec<i64>> {
        let records = sqlx::query!(
            r#"
            SELECT collection_id FROM collection_items WHERE book_id = ?
            "#,
            book_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(records.into_iter().map(|r| r.collection_id).collect())
    }

    async fn set_collections_for_book(&self, book_id: i64, collection_ids: &[i64]) -> Result<()> {
        let collection_ids_json = serde_json::to_string(collection_ids)?;
        let mut tx = self.pool.begin().await?;

        // Kept rows stay as they are, keeping when the book was added to the collection.
        sqlx::query!(
            r#"
            DELETE FROM collection_items
            WHERE book_id = ? AND collection_id NOT IN (SELECT value FROM json_each(?))
            "#,
            book_id,
            collection_ids_json
        )
        .execute(&mut *tx)
        .await?;

        // The JOIN skips a stale collection_id instead of raising a FOREIGN KEY error, which
        // OR IGNORE does not suppress; OR IGNORE skips the kept rows.
        sqlx::query!(
            r#"
            INSERT OR IGNORE INTO collection_items (collection_id, book_id)
            SELECT c.id, ?
            FROM collections c
            WHERE c.id IN (SELECT value FROM json_each(?))
            "#,
            book_id,
            collection_ids_json
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    async fn delete(&self, id: i64) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM collections
            WHERE id = ?
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
