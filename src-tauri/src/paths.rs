//! Where the app keeps its data.

use std::path::PathBuf;
use tauri::{Manager, Runtime};

use crate::error;

/// Reads a non-empty `ROOKREADER_DATA_DIR` override into a path, if present.
#[cfg(any(debug_assertions, feature = "e2e-test"))]
fn data_dir_from_env(var: Option<std::ffi::OsString>) -> Option<PathBuf> {
    var.filter(|v| !v.is_empty()).map(PathBuf::from)
}

/// Resolves the base directory for app data (DB, settings, thumbnails).
///
/// In debug builds and in the `e2e-test` E2E build, a non-empty `ROOKREADER_DATA_DIR`
/// environment variable overrides Tauri's `app_data_dir()`, so E2E tests run against an
/// isolated, ephemeral directory instead of the real user profile. Shipped/production builds
/// (release without the feature) always use `app_data_dir()`.
///
/// # Arguments
///
/// * `manager` - Any Tauri manager (`App` or `AppHandle`) able to resolve paths.
///
/// # Returns
///
/// The base directory that holds the app's data files.
///
/// # Errors
///
/// Returns an `Err` if the app data directory cannot be resolved.
pub(crate) fn app_data_dir<R: Runtime, M: Manager<R>>(manager: &M) -> error::Result<PathBuf> {
    #[cfg(any(debug_assertions, feature = "e2e-test"))]
    if let Some(dir) = data_dir_from_env(std::env::var_os("ROOKREADER_DATA_DIR")) {
        return Ok(dir);
    }
    Ok(manager.path().app_data_dir()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(any(debug_assertions, feature = "e2e-test"))]
    #[test]
    fn env_override_used_when_non_empty() {
        assert_eq!(
            data_dir_from_env(Some(std::ffi::OsString::from("/tmp/rr-e2e"))),
            Some(PathBuf::from("/tmp/rr-e2e"))
        );
    }

    #[cfg(any(debug_assertions, feature = "e2e-test"))]
    #[test]
    fn env_override_ignored_when_absent_or_empty() {
        assert_eq!(data_dir_from_env(None), None);
        assert_eq!(data_dir_from_env(Some(std::ffi::OsString::new())), None);
    }
}
