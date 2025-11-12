use unrar::{Archive, CursorBeforeHeader, OpenArchive, Process};

use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use crate::container::container::{Container, ContainerError, Image};

/// RAR 書庫コンテナー
pub struct RarContainer {
    /// コンテナーのファイルパス
    path: String,
    /// コンテナー内のエントリー
    entries: Vec<String>,
    /// 画像データのキャッシュ (キー: ページインデックス, 値: 画像バイナリ)
    cache: HashMap<String, Arc<Image>>,
}

impl Container for RarContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // まずはキャッシュから取得する
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            return Ok(Arc::clone(&image_arc));
        }

        let mut image: Option<Arc<Image>> = None;
        let mut archive = open(&self.path)?;
        while let Some(header) = archive.read_header().map_err(|e| ContainerError {
            message: format!("Failed to read header. {}", e),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })? {
            let filename = header
                .entry()
                .filename
                .as_os_str()
                .to_string_lossy()
                .to_string();
            if filename == *entry {
                let (data, rest) = header.read().map_err(|e| ContainerError {
                    message: format!("Failed to read data in the rar. {}", e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
                drop(rest); // close the archive
                match Image::new(data) {
                    Ok(img) => {
                        let img_arc = Arc::new(img);
                        self.cache.insert(entry.clone(), Arc::clone(&img_arc));
                        image = Some(img_arc);
                        break;
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
            } else {
                archive = header.skip().map_err(|e| ContainerError {
                    message: e.to_string(),
                    path: Some(self.path.clone()),
                    entry: Some(filename.clone()),
                })?;
            }
        }
        if let Some(img_arc) = image {
            Ok(img_arc)
        } else {
            Err(ContainerError {
                message: format!("Entry not found: {}.", entry),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })
        }
    }

    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        if begin_index >= end {
            return Ok(());
        }

        let target_names: HashSet<String> =
            self.entries[begin_index..end].iter().cloned().collect();
        let mut remaining = target_names.len();

        let mut archive = open(&self.path)?;
        while let Some(header) = archive.read_header().map_err(|e| ContainerError {
            message: format!("Failed to read header. {}", e),
            path: Some(self.path.clone()),
            entry: None,
        })? {
            let filename = header
                .entry()
                .filename
                .as_os_str()
                .to_string_lossy()
                .to_string();
            if target_names.contains(&filename) {
                if self.cache.contains_key(&filename) {
                    archive = header.skip().map_err(|e| ContainerError {
                        message: format!("Failed to skip data in the rar. {}", e),
                        path: Some(self.path.clone()),
                        entry: Some(filename.clone()),
                    })?;
                    remaining = remaining.saturating_sub(1);
                    if remaining == 0 {
                        break;
                    }
                    continue;
                }

                let (data, rest) = header.read().map_err(|e| ContainerError {
                    message: format!("Failed to read data in the rar. {}", e),
                    path: Some(self.path.clone()),
                    entry: Some(filename.clone()),
                })?;
                archive = rest; // continue from returned archive

                match Image::new(data) {
                    Ok(img) => {
                        self.cache.insert(filename.clone(), Arc::new(img));
                        remaining = remaining.saturating_sub(1);
                        if remaining == 0 {
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("{}", e);
                        return Err(ContainerError {
                            message: e,
                            path: Some(self.path.clone()),
                            entry: Some(filename.clone()),
                        });
                    }
                }
            } else {
                archive = header.skip().map_err(|e| ContainerError {
                    message: format!("Failed to skip data in the rar. {}", e),
                    path: Some(self.path.clone()),
                    entry: Some(filename.clone()),
                })?
            }
        }

        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError> {
        Ok(self.cache.get(entry).map(|arc| Arc::clone(arc)))
    }
}

impl RarContainer {
    /// インスタンスを生成する
    ///
    /// * `path` - コンテナーファイルのパス
    pub fn new(path: &String) -> Result<Self, ContainerError> {
        let archive = Archive::new(path)
            .open_for_listing()
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to open the rar file. {}", e)),
                path: Some(path.clone()),
                entry: None,
            })?;

        let mut entries: Vec<String> = Vec::new();
        for entry_result in archive {
            let entry = entry_result.map_err(|e| ContainerError {
                message: String::from(format!("Failed to get entries of the rar file. {}", e)),
                path: Some(path.clone()),
                entry: None,
            })?;
            if entry.is_file() {
                entries.push(entry.filename.as_os_str().to_string_lossy().to_string());
            }
        }

        Ok(Self {
            path: path.clone(),
            entries: entries,
            cache: HashMap::new(),
        })
    }
}

fn open(path: &String) -> Result<OpenArchive<Process, CursorBeforeHeader>, ContainerError> {
    let archive = Archive::new(path)
        .open_for_processing()
        .map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the rar file. {}", e)),
            path: Some(path.clone()),
            entry: None,
        })?;

    Ok(archive)
}
