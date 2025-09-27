use std::{collections::HashMap, fs::File, io::Read};

use zip::ZipArchive;

use crate::container::container::{Container, ContainerError, Image};

/// ZIP 書庫コンテナー
pub struct ZipContainer {
    /// コンテナーのファイルパス
    path: String,
    /// Zip アーカイブ
    archive: ZipArchive<File>,
    /// コンテナー内のエントリー
    entries: Vec<String>,
    /// 画像データのキャッシュ (キー: ページインデックス, 値: 画像バイナリ)
    cache: HashMap<String, Image>,
}

impl Container for ZipContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Image, ContainerError> {
        // まずはキャッシュから取得する
        if let Some(image) = self.get_image_from_cache(entry)? {
            return Ok(image.clone());
        }

        let mut file_in_zip = self.archive.by_name(entry).map_err(|e| ContainerError {
            message: String::from(format!("Failed to get entry. {}", e)),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;
        let mut buffer = Vec::new();
        file_in_zip
            .read_to_end(&mut buffer)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to read entry in the zip archive. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        match Image::new(buffer) {
            Ok(image) => {
                self.cache.insert(entry.clone(), image.clone());
                Ok(image)
            }
            Err(e) => {
                log::error!("{}", e);
                Err(ContainerError {
                    message: e,
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })
            }
        }
    }

    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        for i in begin_index..end {
            // すでにキャッシュにあればスキップ
            let entry = &self.entries[i];
            if self.cache.contains_key(entry) {
                log::debug!("Hit cache so skip preload index: {}", i);
                continue;
            }

            let mut buffer = Vec::new();
            {
                let mut file = self.archive.by_name(entry).map_err(|e| ContainerError {
                    message: format!("Failed to get the file. {}", e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;

                file.read_to_end(&mut buffer).map_err(|e| ContainerError {
                    message: String::from(format!(
                        "Failed to read entry in the zip archive. {}",
                        e
                    )),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            };

            match Image::new(buffer) {
                Ok(image) => {
                    self.cache.insert(entry.clone(), image);
                }
                Err(e) => {
                    log::error!("{}", e);
                    return Err(ContainerError {
                        message: e,
                        path: Some(self.path.clone()),
                        entry: Some(entry.clone()),
                    });
                }
            }
        }
        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Image>, ContainerError> {
        match self.cache.get(entry) {
            Some(image) => {
                log::debug!("Hit cache so get_image() returns cache of {}", entry);
                Ok(Some(image.clone()))
            }
            None => Ok(None),
        }
    }
}

impl ZipContainer {
    pub fn new(path: &String) -> Result<Self, ContainerError> {
        let file = File::open(path).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the file. {}", e)),
            path: Some(path.clone()),
            entry: None,
        })?;
        let archive = ZipArchive::new(file).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the zip archive. {}", e)),
            path: Some(path.clone()),
            entry: None,
        })?;

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

        Ok(Self {
            path: path.clone(),
            archive: archive,
            entries: entries,
            cache: HashMap::new(),
        })
    }
}
