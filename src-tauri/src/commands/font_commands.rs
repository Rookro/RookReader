use font_kit::source::SystemSource;
use tokio::sync::OnceCell;

use crate::{
    blocking::run_blocking,
    error::{Error, Result},
};

/// The installed font families, scanned once per app run.
static FONTS: OnceCell<Vec<String>> = OnceCell::const_new();

/// Retrieves a list of all font families installed on the system.
///
/// The system is scanned on a blocking thread the first time, and the list is reused for
/// the rest of the app run; fonts installed meanwhile appear after a restart.
///
/// # Returns
///
/// A `Vec<String>` containing the sorted names of all installed font families. If the
/// system's font source cannot be read, an empty vector; the next call scans again.
#[tauri::command]
#[specta::specta]
pub async fn get_fonts() -> Vec<String> {
    log::debug!("Get fonts.");
    match cached_fonts(&FONTS, scan_fonts).await {
        Ok(fonts) => fonts,
        Err(e) => {
            log::warn!("{e}");
            Vec::new()
        }
    }
}

/// Returns the list in `cache`, running `scan` on a blocking thread to fill it first.
/// A failed scan leaves the cache empty, so the next call scans again.
async fn cached_fonts<F>(cache: &OnceCell<Vec<String>>, scan: F) -> Result<Vec<String>>
where
    F: FnOnce() -> Result<Vec<String>> + Send + 'static,
{
    cache.get_or_try_init(|| run_blocking(scan)).await.cloned()
}

/// Lists the installed font families, sorted.
fn scan_fonts() -> Result<Vec<String>> {
    let mut families = SystemSource::new()
        .all_families()
        .map_err(|e| Error::Other(format!("Failed to list the system fonts: {e}")))?;
    families.sort();
    Ok(families)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    #[tokio::test]
    async fn scans_the_fonts_only_once() {
        let cache = OnceCell::new();
        let scans = Arc::new(AtomicUsize::new(0));
        for _ in 0..2 {
            let scans = Arc::clone(&scans);
            let fonts = cached_fonts(&cache, move || {
                scans.fetch_add(1, Ordering::SeqCst);
                Ok(vec!["Arial".to_string()])
            })
            .await
            .unwrap();
            assert_eq!(fonts, vec!["Arial".to_string()]);
        }
        assert_eq!(scans.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn scans_again_after_a_failed_scan() {
        let cache = OnceCell::new();
        let failed = cached_fonts(&cache, || Err(Error::Other("no fonts".to_string()))).await;
        assert!(failed.is_err());
        let fonts = cached_fonts(&cache, || Ok(vec!["Arial".to_string()]))
            .await
            .unwrap();
        assert_eq!(fonts, vec!["Arial".to_string()]);
    }

    #[tokio::test]
    async fn test_get_fonts() {
        let fonts = get_fonts().await;
        // We can't easily know which fonts are on the system,
        // but we can check if it returns a vector (likely non-empty on most systems).
        // On CI it might be empty depending on the environment.
        assert!(!fonts.is_empty());
    }
}
