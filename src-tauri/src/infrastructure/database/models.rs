use chrono::NaiveDateTime;
use sqlx::FromRow;

use crate::domain::book::entity::{Book, BookWithState, ReadBook};
use crate::error::{Error, Result};

/// A row of `books`, as the database stores it.
#[derive(Debug, FromRow)]
pub struct BookRow {
    pub id: i64,
    pub file_path: String,
    pub item_type: String,
    pub display_name: String,
    pub total_pages: i64,
    pub series_id: Option<i64>,
    pub series_order: Option<i64>,
    pub thumbnail_path: Option<String>,
}

impl TryFrom<BookRow> for Book {
    type Error = Error;

    fn try_from(r: BookRow) -> Result<Self> {
        Ok(Book {
            id: r.id,
            file_path: r.file_path,
            item_type: r.item_type.parse()?,
            display_name: r.display_name,
            total_pages: r.total_pages,
            series_id: r.series_id,
            series_order: r.series_order,
            thumbnail_path: r.thumbnail_path,
        })
    }
}

/// A `books` row joined with its `reading_state`, for the recently-read list.
#[derive(Debug, FromRow)]
pub struct ReadBookRow {
    pub id: i64,
    pub file_path: String,
    pub item_type: String,
    pub display_name: String,
    pub total_pages: i64,
    pub series_id: Option<i64>,
    pub series_order: Option<i64>,
    pub thumbnail_path: Option<String>,
    pub last_read_page_index: i64,
    pub last_opened_at: NaiveDateTime,
}

impl TryFrom<ReadBookRow> for ReadBook {
    type Error = Error;

    fn try_from(r: ReadBookRow) -> Result<Self> {
        Ok(ReadBook {
            id: r.id,
            file_path: r.file_path,
            item_type: r.item_type.parse()?,
            display_name: r.display_name,
            total_pages: r.total_pages,
            series_id: r.series_id,
            series_order: r.series_order,
            thumbnail_path: r.thumbnail_path,
            last_read_page_index: r.last_read_page_index,
            last_opened_at: r.last_opened_at,
        })
    }
}

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
    /// Whether the reader has shifted this book's spreads by one page.
    ///
    /// Beside `total_pages` rather than in the reading state: it is a correction to how
    /// the book is laid out, and turning reading history off — or clearing it — must not
    /// discard it.
    pub is_spread_shifted: bool,
    /// One `'0'`/`'1'` per page in entry order, `'1'` where the page is wider than it is
    /// tall. `None` until the book has been measured once.
    ///
    /// A landscape page is one physical spread, so it always starts on an even page:
    /// that is what settles where two-page spreads begin, and 200 bytes is the whole
    /// measurement for a 200-page book.
    pub landscape_bits: Option<String>,
    /// The page direction this book opens with, `"rtl"` or `"ltr"`.
    ///
    /// Seeded from the reader's default the first time the book is opened, then
    /// overwritten whenever the direction is flipped in the navigation bar. `None` until
    /// the book has been opened once, and always `None` for novels, whose direction is
    /// the EPUB's own and cannot be overridden.
    pub reading_direction: Option<String>,
    /// The last read page index, if the book has been opened.
    pub last_read_page_index: Option<i64>,
    /// The timestamp when the book was last opened, if any.
    pub last_opened_at: Option<NaiveDateTime>,
    /// The last EPUB reading position (CFI), if any. `None` for comics.
    pub cfi: Option<String>,
    /// Comma-separated list of tag IDs associated with this book.
    pub tag_ids_str: Option<String>,
}

impl TryFrom<BookWithStateRow> for BookWithState {
    type Error = Error;

    fn try_from(r: BookWithStateRow) -> Result<Self> {
        Ok(BookWithState {
            id: r.id,
            file_path: r.file_path,
            item_type: r.item_type.parse()?,
            display_name: r.display_name,
            total_pages: r.total_pages,
            series_id: r.series_id,
            series_order: r.series_order,
            thumbnail_path: r.thumbnail_path,
            created_at: r.created_at,
            is_spread_shifted: r.is_spread_shifted,
            landscape_bits: r.landscape_bits,
            reading_direction: r.reading_direction,
            last_read_page_index: r.last_read_page_index,
            last_opened_at: r.last_opened_at,
            cfi: r.cfi,
            tag_ids: r
                .tag_ids_str
                .as_deref()
                .map(parse_tag_ids)
                .unwrap_or_default(),
        })
    }
}

/// Parses the view's comma-joined tag id list, skipping anything that is not an id.
///
/// # Arguments
///
/// * `joined` - The `tag_ids_str` column, e.g. `"1,2,3"`.
///
/// # Returns
///
/// The ids in the order they were joined.
pub fn parse_tag_ids(joined: &str) -> Vec<i64> {
    joined
        .split(',')
        .filter_map(|id| id.trim().parse::<i64>().ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::parse_tag_ids;

    #[test]
    fn parse_tag_ids_keeps_the_ids_and_drops_the_rest() {
        assert_eq!(parse_tag_ids("1,2,3"), vec![1, 2, 3]);
        assert_eq!(parse_tag_ids(" 4 , 5, 6 "), vec![4, 5, 6]);
        assert!(parse_tag_ids("").is_empty());
        assert_eq!(parse_tag_ids("1,abc,3"), vec![1, 3]);
    }
}
