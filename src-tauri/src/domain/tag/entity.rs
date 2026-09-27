use serde::{Deserialize, Serialize};

/// Represents a tag entity used to categorize books.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Tag {
    /// The unique identifier for the tag.
    pub id: i64,
    /// The unique name of the tag.
    pub name: String,
    /// The color code of the tag (e.g., "#FF0000" for red).
    pub color_code: String,
}
