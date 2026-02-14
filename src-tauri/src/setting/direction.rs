use std::{fmt::Display, str::FromStr};

use serde_json::Value;
use strum_macros::EnumString;

/// Represents the direction of reading.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum Direction {
    /// Right-to-left reading direction.
    RTL,
    /// Left-to-right reading direction.
    LTR,
}

impl Default for Direction {
    fn default() -> Self {
        Self::RTL
    }
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
            Self::RTL => write!(f, "RTL"),
            Self::LTR => write!(f, "LTR"),
        }
    }
}
