use std::{fmt::Display, str::FromStr};

use serde_json::Value;
use strum_macros::EnumString;

/// Represents the available sort orders for file and directory listings.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum SortOrder {
    /// Sort by name in ascending alphabetical order (A-Z).
    NameAsc,
    /// Sort by name in descending alphabetical order (Z-A).
    NameDesc,
    /// Sort by modification date in ascending order (oldest first).
    DateAsc,
    /// Sort by modification date in descending order (newest first).
    DateDesc,
}

impl From<Value> for SortOrder {
    fn from(value: Value) -> Self {
        match value.as_str() {
            Some(value_str) => SortOrder::from_str(value_str).unwrap_or(SortOrder::NameAsc),
            None => SortOrder::NameAsc,
        }
    }
}

impl Display for SortOrder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SortOrder::NameAsc => write!(f, "NameAsc"),
            SortOrder::NameDesc => write!(f, "NameDesc"),
            SortOrder::DateAsc => write!(f, "DateAsc"),
            SortOrder::DateDesc => write!(f, "DateDesc"),
        }
    }
}
