use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Represents a collection entity used to organize books.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Collection {
    /// The unique identifier for the collection.
    pub id: i64,
    /// The display name of the collection.
    pub name: String,
    /// The string identifier for the UI icon (e.g., "folder").
    pub icon_id: String,
    /// The timestamp when the collection was created.
    pub created_at: Option<NaiveDateTime>,
}
