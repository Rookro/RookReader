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
pub async fn get_fonts() -> Vec<String> {
    log::debug!("Get fonts.");
    let source = SystemSource::new();
    let mut families = source.all_families().unwrap_or_default();
    families.sort();
    families
}
