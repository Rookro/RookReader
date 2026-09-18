use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use strum_macros::{EnumString, IntoStaticStr};

/// What a book's path points at.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Serialize,
    Deserialize,
    EnumString,
    IntoStaticStr,
    specta::Type,
)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum ItemType {
    /// An archive, PDF or EPUB file.
    File,
    /// A folder of pages.
    Directory,
}

/// Represents a book entity in the database.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Book {
    /// The unique identifier for the book.
    pub id: i64,
    /// The unique file path or directory path of the book.
    pub file_path: String,
    /// What the path points at.
    pub item_type: ItemType,
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
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ReadingState {
    /// The unique identifier for the associated book.
    pub book_id: i64,
    /// The last read page index.
    pub last_read_page_index: i64,
    /// The last EPUB reading position (CFI). `None` for comics.
    pub cfi: Option<String>,
    /// The timestamp when the book was last opened.
    pub last_opened_at: Option<NaiveDateTime>,
}

/// Represents a book along with its reading state, specifically for books that have been opened.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ReadBook {
    /// The unique identifier for the book.
    pub id: i64,
    /// The unique file path or directory path of the book.
    pub file_path: String,
    /// What the path points at.
    pub item_type: ItemType,
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
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct BookWithState {
    /// The unique identifier for the book.
    pub id: i64,
    /// The unique file path or directory path of the book.
    pub file_path: String,
    /// What the path points at.
    pub item_type: ItemType,
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
    /// List of tag IDs associated with this book.
    #[serde(default)]
    pub tag_ids: Vec<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_type_is_a_lowercase_word_on_the_wire_and_in_the_database() {
        assert_eq!(
            serde_json::to_value(ItemType::Directory).unwrap(),
            serde_json::json!("directory")
        );
        assert_eq!("file".parse::<ItemType>(), Ok(ItemType::File));
        assert_eq!(<&str>::from(ItemType::Directory), "directory");
    }
}
