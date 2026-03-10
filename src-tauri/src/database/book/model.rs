use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents a book entity in the database.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Book {
    /// The unique identifier for the book.
    pub id: i64,
    /// The unique file path or directory path of the book.
    pub file_path: String,
    /// The type of the item ('file' or 'directory').
    pub item_type: String,
    /// The display name of the book.
    pub display_name: String,
    /// The total number of pages in the book.
    pub total_pages: i64,
    /// The optional identifier of the series this book belongs to.
    pub series_id: Option<i64>,
    /// The optional order index of the book within its series.
    pub series_order: Option<i64>,
    /// The optional file path to the thumbnail image of the book.
    pub thumbnail_path: Option<String>,
}

/// Represents the reading state of a specific book.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ReadingState {
    /// The unique identifier for the associated book.
    pub book_id: i64,
    /// The last read page index.
    pub last_read_page_index: i64,
    /// The timestamp when the book was last opened.
    pub last_opened_at: Option<NaiveDateTime>,
}

/// Represents a book along with its reading state, specifically for books that have been opened.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ReadBook {
    /// The unique identifier for the book.
    pub id: i64,
    /// The unique file path or directory path of the book.
    pub file_path: String,
    /// The type of the item ('file' or 'directory').
    pub item_type: String,
    /// The display name of the book.
    pub display_name: String,
    /// The total number of pages in the book.
    pub total_pages: i64,
    /// The optional identifier of the series this book belongs to.
    pub series_id: Option<i64>,
    /// The optional order index of the book within its series.
    pub series_order: Option<i64>,
    /// The optional file path to the thumbnail image of the book.
    pub thumbnail_path: Option<String>,
    /// The last read page index.
    pub last_read_page_index: i64,
    /// The timestamp when the book was last opened.
    /// This is guaranteed to be present (not null) for read books.
    pub last_opened_at: NaiveDateTime,
}

/// Represents a book along with its optional reading state.
/// Useful for displaying book details whether it has been read or not.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BookWithState {
    /// The unique identifier for the book.
    pub id: i64,
    /// The unique file path or directory path of the book.
    pub file_path: String,
    /// The type of the item ('file' or 'directory').
    pub item_type: String,
    /// The display name of the book.
    pub display_name: String,
    /// The total number of pages in the book.
    pub total_pages: i64,
    /// The optional identifier of the series this book belongs to.
    pub series_id: Option<i64>,
    /// The optional order index of the book within its series.
    pub series_order: Option<i64>,
    /// The optional file path to the thumbnail image of the book.
    pub thumbnail_path: Option<String>,
    /// The last read page index, if the book has been opened.
    pub last_read_page_index: Option<i64>,
    /// The timestamp when the book was last opened, if any.
    pub last_opened_at: Option<NaiveDateTime>,
    /// Comma-separated list of tag IDs associated with this book.
    pub tag_ids_str: Option<String>,
}
