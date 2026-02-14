use std::{fmt::Display, str::FromStr};

use serde_json::Value;
use strum_macros::EnumString;

/// Represents the sort order.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum SortOrder {
    /// Sort by name in ascending order.
    NameAsc,
    /// Sort by name in descending order.
    NameDesc,
    /// Sort by date in ascending order.
    DateAsc,
    /// Sort by date in descending order.
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
