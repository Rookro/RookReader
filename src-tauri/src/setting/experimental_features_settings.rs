use std::fmt::Display;

use serde_json::Value;

/// Represents settings for experimental, potentially unstable features.
pub struct ExperimentalFeaturesSettings {}

impl ExperimentalFeaturesSettings {
    /// Create a new instance of `ExperimentalFeaturesSettings`.
    ///
    /// # Returns
    ///
    /// A new instance of `ExperimentalFeaturesSettings`.
    pub fn new() -> Self {
        Self {}
    }
}

impl Default for ExperimentalFeaturesSettings {
    fn default() -> Self {
        Self::new()
    }
}

impl From<Value> for ExperimentalFeaturesSettings {
    fn from(_value: Value) -> Self {
        Self {}
    }
}

impl Display for ExperimentalFeaturesSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ExperimentalFeaturesSettings {{}}")
    }
}
