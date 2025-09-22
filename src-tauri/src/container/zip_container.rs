use std::{
    collections::HashMap,
    fs::File,
    io::{Cursor, Read},
};

use image::ImageReader;
use zip::ZipArchive;

use crate::container::container::{Container, ContainerError, Image};

pub struct ZipContainer {
    path: String,
}

impl Default for ZipContainer {
    fn default() -> Self {
        Self {
            path: String::from(""),
        }
    }
}

impl Container for ZipContainer {
    fn get_entries(&self) -> Result<Vec<String>, ContainerError> {
        let archive = self.open()?;
        let entries: Vec<String> = archive
            .file_names()
            .filter(|name| {
                name.ends_with(".png")
                    || name.ends_with(".jpg")
                    || name.ends_with(".jpeg")
                    || name.ends_with(".webp")
                    || name.ends_with(".avif")
            })
            .map(|s| s.to_string())
            .collect();

        Ok(entries)
    }

    fn get_image(&self, entry: &String) -> Result<Image, ContainerError> {
        let mut archive = self.open()?;
        let mut file_in_zip = archive.by_name(entry).map_err(|e| ContainerError {
            message: String::from(format!("Failed to get entry. {}", e.to_string())),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;
        let mut buffer = Vec::new();
        file_in_zip
            .read_to_end(&mut buffer)
            .map_err(|e| ContainerError {
                message: String::from(format!(
                    "Failed to read entry in the zip archive. {}",
                    e.to_string()
                )),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        // 画像サイズを取得する
        let cursor = Cursor::new(&buffer);
        let image_reader = ImageReader::new(cursor)
            .with_guessed_format()
            .map_err(|e| ContainerError {
                message: String::from(format!(
                    "Failed to read entry in the zip archive. {}",
                    e.to_string()
                )),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;
        // 画像全体をデコードせず、サイズのみを読み取る
        match image_reader.into_dimensions() {
            Ok((width, height)) => Ok(Image {
                data: buffer,
                width,
                height,
            }),
            Err(e) => {
                let error_message = format!("Failed to get image size. {}", e.to_string());
                log::error!("{}", error_message);
                Err(ContainerError {
                    message: error_message,
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })
            }
        }
    }

    fn preload(
        &self,
        cache: &mut HashMap<String, Image>,
        entries: &Vec<String>,
        start_index: usize,
        count: usize,
    ) -> Result<(), ContainerError> {
        let total_pages = entries.len();
        let end = (start_index + count).min(total_pages);

        for i in start_index..end {
            // すでにキャッシュにあればスキップ
            let entry = &entries[i];
            if cache.contains_key(entry) {
                continue;
            }

            let mut archive = self.open()?;
            let mut file = archive.by_name(entry).map_err(|e| ContainerError {
                message: format!("Failed to get the file. {}", e.to_string()),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer).map_err(|e| ContainerError {
                message: String::from(format!(
                    "Failed to read entry in the zip archive. {}",
                    e.to_string()
                )),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

            let cursor = Cursor::new(&buffer);
            let image_reader = ImageReader::new(cursor)
                .with_guessed_format()
                .map_err(|e| ContainerError {
                    message: String::from(format!(
                        "Failed to read entry in the zip archive. {}",
                        e.to_string()
                    )),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            match image_reader.into_dimensions() {
                Ok((width, height)) => {
                    let image = Image {
                        data: buffer,
                        width,
                        height,
                    };
                    cache.insert(entry.clone(), image);
                }
                Err(e) => {
                    let error_message = format!("Failed to get image size. {}", e.to_string());
                    log::error!("{}", error_message);
                    return Err(ContainerError {
                        message: error_message,
                        path: Some(self.path.clone()),
                        entry: Some(entry.clone()),
                    });
                }
            }
        }
        Ok(())
    }
}

impl ZipContainer {
    pub fn new(path: &String) -> Self {
        Self { path: path.clone() }
    }

    fn open(&self) -> Result<ZipArchive<File>, ContainerError> {
        let file = File::open(&self.path).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the file. {}", e.to_string())),
            path: Some(self.path.clone()),
            entry: None,
        })?;
        let archive = ZipArchive::new(file).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the zip archive. {}", e.to_string())),
            path: Some(self.path.clone()),
            entry: None,
        })?;

        Ok(archive)
    }
}
