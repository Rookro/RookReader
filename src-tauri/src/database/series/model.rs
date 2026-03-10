use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Represents a series entity that groups multiple books together.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Series {
    /// The unique identifier for the series.
    pub id: i64,
    /// The unique name of the series.
    pub name: String,
}
