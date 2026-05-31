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
    #[serde(skip)]
    pub tag_ids_str: Option<String>,
    /// List of tag IDs associated with this book.
    #[serde(default)]
    #[sqlx(skip)]
    pub tag_ids: Vec<i64>,
}

impl BookWithState {
    /// Returns a list of tag IDs associated with the book.
    ///
    /// This method parses the internal `tag_ids_str` which is expected to be
    /// a comma-separated string of integers.
    ///
    /// # Returns
    ///
    /// A `Vec<i64>` containing the parsed tag IDs.
    pub fn tag_ids(&self) -> Vec<i64> {
        self.tag_ids_str
            .as_ref()
            .map(|s| {
                s.split(',')
                    .filter_map(|id| id.trim().parse::<i64>().ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Populates the `tag_ids` field by parsing `tag_ids_str`.
    ///
    /// # Arguments
    ///
    /// * `&mut self` - The mutable reference to the book state.
    pub fn fill_tag_ids(&mut self) {
        self.tag_ids = self.tag_ids();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_book_with_state_tag_ids_parsing() {
        let mut book = BookWithState {
            id: 1,
            file_path: "path".to_string(),
            item_type: "file".to_string(),
            display_name: "name".to_string(),
            total_pages: 10,
            series_id: None,
            series_order: None,
            thumbnail_path: None,
            last_read_page_index: None,
            last_opened_at: None,
            tag_ids_str: Some("1,2,3".to_string()),
            tag_ids: vec![],
        };
        assert_eq!(book.tag_ids(), vec![1, 2, 3]);
        book.fill_tag_ids();
        assert_eq!(book.tag_ids, vec![1, 2, 3]);

        let mut book_with_spaces = BookWithState {
            tag_ids_str: Some(" 4 , 5, 6 ".to_string()),
            ..book.clone()
        };
        assert_eq!(book_with_spaces.tag_ids(), vec![4, 5, 6]);
        book_with_spaces.fill_tag_ids();
        assert_eq!(book_with_spaces.tag_ids, vec![4, 5, 6]);

        let mut book_empty = BookWithState {
            tag_ids_str: None,
            ..book.clone()
        };
        assert!(book_empty.tag_ids().is_empty());
        book_empty.fill_tag_ids();
        assert!(book_empty.tag_ids.is_empty());

        let mut book_invalid = BookWithState {
            tag_ids_str: Some("1,abc,3".to_string()),
            ..book
        };
        assert_eq!(book_invalid.tag_ids(), vec![1, 3]);
        book_invalid.fill_tag_ids();
        assert_eq!(book_invalid.tag_ids, vec![1, 3]);
    }
}
