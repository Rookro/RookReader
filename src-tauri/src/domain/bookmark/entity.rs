use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents a saved reading position (bookmark) within a book.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, specta::Type)]
pub struct Bookmark {
    /// The unique identifier for the bookmark.
    pub id: i64,
    /// The identifier of the book this bookmark belongs to.
    pub book_id: i64,
    /// The display name of the bookmark.
    pub name: String,
    /// The bookmarked page index: the comic page, or the EPUB spine section index.
    pub page_index: i64,
    /// The bookmarked position within an EPUB section (CFI). `None` for comics.
    pub cfi: Option<String>,
    /// The timestamp when the bookmark was created.
    pub created_at: NaiveDateTime,
}
