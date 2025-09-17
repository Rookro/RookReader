use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    pub is_directory: bool,
    pub name: String,
}

#[tauri::command()]
pub fn get_entries_in_dir(dir_path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in fs::read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_e| "failed to get file name from DirEntry.")?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;

        entries.push(DirEntry {
            is_directory: file_type.is_dir(),
            name: file_name,
        });
    }

    Ok(entries)
}
