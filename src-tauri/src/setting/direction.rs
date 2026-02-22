use std::{fmt::Display, str::FromStr};

use serde_json::Value;
use strum_macros::EnumString;

/// Represents the reading direction of the content, e.g., for books or comics.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
#[derive(Default)]
pub enum Direction {
    /// Right-to-Left reading direction, common for manga and some scripts.
    #[default]
    Rtl,
    /// Left-to-Right reading direction, standard for most Western languages.
    Ltr,
}

impl From<Value> for Direction {
    fn from(value: Value) -> Self {
        match value.as_str() {
            Some(value_str) => Self::from_str(value_str).unwrap_or_default(),
            None => Self::default(),
        }
    }
}

impl Display for Direction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Rtl => write!(f, "RTL"),
            Self::Ltr => write!(f, "LTR"),
        }
    }
}
