use std::{fmt::Display, str::FromStr};

use serde_json::Value;
use strum_macros::EnumString;

use crate::error;

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

impl TryFrom<Value> for SortOrder {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        match value.as_str() {
            Some(value_str) => SortOrder::from_str(value_str).map_err(|e| e.into()),
            None => Err(error::Error::Settings("Invalid sort order.".to_string())),
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
