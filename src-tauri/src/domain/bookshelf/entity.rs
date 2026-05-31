use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents a bookshelf entity used to organize books.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bookshelf {
    /// The unique identifier for the bookshelf.
    pub id: i64,
    /// The display name of the bookshelf.
    pub name: String,
    /// The string identifier for the UI icon (e.g., "folder").
    pub icon_id: String,
    /// The timestamp when the bookshelf was created.
    pub created_at: Option<NaiveDateTime>,
}
