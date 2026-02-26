use async_trait::async_trait;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::{
    path::{Path, PathBuf},
    str::FromStr,
};

use crate::database::history::{history_repository::HistoryRepository, models::HistoryEntry};
use crate::error::Result;

/// A SQLite-backed implementation of the `HistoryRepository`.
///
/// This repository uses `sqlx` to manage a connection pool to a SQLite database
/// and perform operations on history entries.
pub struct SqliteHistoryRepository {
    pool: SqlitePool,
}

impl SqliteHistoryRepository {
    /// Initializes the SQLite repository.
    ///
    /// This function connects to the database at the given file path, creates it if it does
    /// not exist, and runs the necessary schema creation queries to ensure the `history`
    /// table and its indexes exist.
    ///
    /// # Arguments
    ///
    /// * `db_path` - The path to the SQLite database file.
    ///
    /// # Returns
    ///
    /// A `Result` containing the initialized `SqliteHistoryRepository` if successful.
    ///
    /// # Errors
    ///
    /// This function will return an `Err` if:
    /// * The database connection pool cannot be established.
    /// * The schema creation queries fail to execute.
    pub async fn init(db_path: PathBuf) -> Result<Self> {
        let db_url = format!("sqlite:{}", db_path.display());
        let options = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);
        log::debug!("Database file path: {:?}", options.get_filename());
        let pool = SqlitePoolOptions::new().connect_with(options).await?;

        sqlx::query!(
            r#"
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                type TEXT CHECK(type IN ('FILE', 'DIRECTORY')) NOT NULL,
                display_name TEXT NOT NULL,
                page_index INTEGER NOT NULL DEFAULT 0,
                last_opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_last_opened_at ON history(last_opened_at DESC);
            "#,
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }
}

#[async_trait]
impl HistoryRepository for SqliteHistoryRepository {
    async fn upsert(&self, path: &str, item_type: &str, page_index: Option<i64>) -> Result<()> {
        let display_name = Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(path);

        let p_index = page_index.unwrap_or(0);

        let query = match page_index {
            Some(_) => {
                sqlx::query!(
                    r#"
                    INSERT INTO history (path, type, display_name, page_index, last_opened_at)
                    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                    ON CONFLICT(path) DO UPDATE SET page_index = $4, last_opened_at = CURRENT_TIMESTAMP;
                    "#,
                    path,
                    item_type,
                    display_name,
                    p_index
                )
            }
            None => {
                sqlx::query!(
                    r#"
                    INSERT INTO history (path, type, display_name, page_index, last_opened_at)
                    VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
                    ON CONFLICT(path) DO UPDATE SET last_opened_at = CURRENT_TIMESTAMP;
                    "#,
                    path,
                    item_type,
                    display_name,
                )
            }
        };

        query.execute(&self.pool).await?;
        Ok(())
    }

    async fn get_all(&self) -> Result<Vec<HistoryEntry>> {
        let entries = sqlx::query_as!(
            HistoryEntry,
            r#"SELECT id, path, type, display_name, page_index, last_opened_at FROM history ORDER BY last_opened_at DESC"#
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(entries)
    }

    async fn get_latest(&self) -> Result<Option<HistoryEntry>> {
        let entry = sqlx::query_as!(
            HistoryEntry,
            r#"SELECT id, path, type, display_name, page_index, last_opened_at FROM history ORDER BY last_opened_at DESC LIMIT 1"#
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(entry)
    }

    async fn get(&self, path: &str) -> Result<Option<HistoryEntry>> {
        let entry = sqlx::query_as!(HistoryEntry, "SELECT * FROM history WHERE path = $1", path)
            .fetch_optional(&self.pool)
            .await?;
        Ok(entry)
    }

    async fn delete(&self, id: i64) -> Result<()> {
        sqlx::query!("DELETE FROM history WHERE id = $1", id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn delete_all(&self) -> Result<()> {
        sqlx::query!("DELETE FROM history")
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
