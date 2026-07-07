use chrono::NaiveDateTime;
use sqlx::FromRow;

use crate::domain::book::entity::BookWithState;

/// Represents a raw row from the `book_with_state_view`.
#[derive(Debug, FromRow)]
pub struct BookWithStateRow {
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
    /// The timestamp when the book was created (registered).
    pub created_at: Option<NaiveDateTime>,
    /// The last read page index, if the book has been opened.
    pub last_read_page_index: Option<i64>,
    /// The timestamp when the book was last opened, if any.
    pub last_opened_at: Option<NaiveDateTime>,
    /// Comma-separated list of tag IDs associated with this book.
    pub tag_ids_str: Option<String>,
}

impl From<BookWithStateRow> for BookWithState {
    fn from(r: BookWithStateRow) -> Self {
        let mut b = BookWithState {
            id: r.id,
            file_path: r.file_path,
            item_type: r.item_type,
            display_name: r.display_name,
            total_pages: r.total_pages,
            series_id: r.series_id,
            series_order: r.series_order,
            thumbnail_path: r.thumbnail_path,
            created_at: r.created_at,
            last_read_page_index: r.last_read_page_index,
            last_opened_at: r.last_opened_at,
            tag_ids_str: r.tag_ids_str,
            tag_ids: Vec::new(),
        };
        b.fill_tag_ids();
        b
    }
}
