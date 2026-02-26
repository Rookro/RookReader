use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Represents an entry in the reading history.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    /// The unique identifier for the history entry.
    pub id: i64,
    /// The file path of the opened item.
    pub path: String,
    /// The type of the item (e.g., "file", "directory").
    pub r#type: String,
    /// The display name of the item.
    pub display_name: String,
    /// The last viewed page index of the item.
    pub page_index: i64,
    /// The timestamp when the item was last opened.
    pub last_opened_at: NaiveDateTime,
}
