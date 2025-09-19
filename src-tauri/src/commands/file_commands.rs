use image::codecs::png::PngEncoder;
use image::{ExtendedColorType, ImageEncoder};
use pdfium::{PdfiumDocument, PdfiumRenderConfig};
use serde::{Deserialize, Serialize};
use std::fs::{read_dir, File};
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Serialize, Deserialize)]
pub struct DirEntry {
    pub is_directory: bool,
    pub name: String,
}

#[tauri::command()]
pub fn get_entries_in_dir(dir_path: String) -> Result<Vec<DirEntry>, String> {
    log::debug!("Get the directory entries in {}", dir_path);
    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in read_dir(dir_path).map_err(|e| e.to_string())? {
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

#[tauri::command()]
pub fn get_entries_in_container(path: String) -> Result<Vec<String>, String> {
    log::debug!("Get the entries in {}", path);

    let ext = Path::new(&path)
        .extension()
        .ok_or(format!("Failed to get extension of {}", path))?
        .to_str()
        .ok_or(format!(
            "Failed to get extension of {}. (Failed to convert to string.)",
            path
        ))?;

    match ext {
        "zip" => get_entries_in_zip(path),
        "pdf" => get_entries_in_pdf(path),
        _ => Err(format!("Unsupported file format: {}", path)),
    }
}

#[tauri::command()]
pub fn get_entry_binary(path: String, entry_name: String) -> Result<Vec<u8>, String> {
    log::debug!("Get the binary of {} in {}", entry_name, path);

    let ext = Path::new(&path)
        .extension()
        .ok_or(format!("Failed to get extension of {}", path))?
        .to_str()
        .ok_or(format!(
            "Failed to get extension of {}. (Failed to convert to string.)",
            path
        ))?;

    match ext {
        "zip" => get_binary_in_zip(path, entry_name),
        "pdf" => get_binary_in_pdf(path, entry_name),
        _ => Err(format!("Unsupported file format: {}", path)),
    }
}

fn get_entries_in_zip(path: String) -> Result<Vec<String>, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut entries: Vec<String> = Vec::new();
    for name in archive.file_names() {
        entries.push(name.to_string());
    }

    Ok(entries)
}

fn get_entries_in_pdf(path: String) -> Result<Vec<String>, String> {
    let document = PdfiumDocument::new_from_path(&path, None).map_err(|e| e.to_string())?;
    let mut entries: Vec<String> = Vec::new();
    for index in 0..document.pages().page_count() {
        entries.push(format!("{:0>4}", index));
    }

    Ok(entries)
}

fn get_binary_in_zip(path: String, entry_name: String) -> Result<Vec<u8>, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut file = archive.by_name(&entry_name).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

    Ok(buffer)
}

fn get_binary_in_pdf(path: String, entry_name: String) -> Result<Vec<u8>, String> {
    let index: i32 = entry_name
        .parse()
        .map_err(|e: std::num::ParseIntError| e.to_string())?;

    let render_config = PdfiumRenderConfig::new().with_height(2000);
    let document = PdfiumDocument::new_from_path(&path, None).map_err(|e| e.to_string())?;
    let page = document.pages().get(index).map_err(|e| e.to_string())?;
    let img = page
        .render(&render_config)
        .map_err(|e| e.to_string())?
        .as_rgb8_image()
        .map_err(|e| e.to_string())?;

    let mut buffer = Vec::new();
    let encoder = PngEncoder::new(&mut buffer);

    encoder
        .write_image(
            &img.as_bytes(),
            img.width(),
            img.height(),
            ExtendedColorType::from(img.color()),
        )
        .map_err(|e| e.to_string())?;

    Ok(buffer)
}
