use font_kit::source::SystemSource;

#[tauri::command]
pub async fn get_fonts() -> Vec<String> {
    log::debug!("Get fonts.");
    let source = SystemSource::new();
    let mut families = source.all_families().unwrap_or_default();
    families.sort();
    families
}
