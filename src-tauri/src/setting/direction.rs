use std::str::FromStr;

use serde_json::Value;
use strum_macros::EnumString;

use crate::error;

/// Represents the direction of reading.
#[derive(Debug, PartialEq, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum Direction {
    /// Right-to-left reading direction.
    RTL,
    /// Left-to-right reading direction.
    LTR,
}

impl TryFrom<Value> for Direction {
    type Error = error::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        match value.as_str() {
            Some(value_str) => Direction::from_str(value_str).map_err(|e| e.into()),
            None => Err(error::Error::Settings("Invalid direction.".to_string())),
        }
    }
}
