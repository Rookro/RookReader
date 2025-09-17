use std::fs::File;
use std::io::Read;
use zip::ZipArchive;

#[tauri::command()]
pub fn get_binary(zip_path: String, entry_name: String) -> Result<Vec<u8>, String> {
    log::debug!("Get the binary of {} in {}", entry_name, zip_path);

    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut file = archive.by_name(&entry_name).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    Ok(buffer)
}

#[tauri::command()]
pub fn get_entries_in_zip(zip_path: String) -> Result<Vec<String>, String> {
    log::debug!("Get the directory entries in {}", zip_path);

    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut entries: Vec<String> = Vec::new();
    for name in archive.file_names() {
        entries.push(name.to_string());
    }

    Ok(entries)
}
