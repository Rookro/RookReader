use font_kit::source::SystemSource;

/// Retrieves a list of all font families installed on the system.
///
/// This function queries the system's font source to get a list of all available
/// font family names, which are then sorted alphabetically.
///
/// # Returns
///
/// A `Vec<String>` containing the sorted names of all installed font families.
/// If the system's font source cannot be accessed or no families are found,
/// it returns an empty vector.
#[tauri::command]
#[specta::specta]
pub async fn get_fonts() -> Vec<String> {
    log::debug!("Get fonts.");
    let source = SystemSource::new();
    let mut families = source.all_families().unwrap_or_default();
    families.sort();
    families
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_fonts() {
        let fonts = get_fonts().await;
        // We can't easily know which fonts are on the system,
        // but we can check if it returns a vector (likely non-empty on most systems).
        // On CI it might be empty depending on the environment.
        assert!(!fonts.is_empty());
    }
}
