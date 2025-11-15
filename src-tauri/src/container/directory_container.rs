use std::{
    collections::HashMap,
    fs::{read_dir, File},
    io::Read,
    path,
    sync::Arc,
};

use crate::container::container::{Container, ContainerError, Image};

/// ディレクトリー書庫コンテナー
pub struct DirectoryContainer {
    /// コンテナーのファイルパス
    path: String,
    /// コンテナー内のエントリー
    entries: Vec<String>,
    /// 画像データのキャッシュ (キー: ページインデックス, 値: 画像バイナリ)
    cache: HashMap<String, Arc<Image>>,
}

impl Container for DirectoryContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // まずはキャッシュから取得する
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            return Ok(Arc::clone(&image_arc));
        }

        let image_arc = self.load_image(entry)?;
        Ok(image_arc)
    }

    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        for i in begin_index..end {
            // すでにキャッシュにあればスキップ
            let entry = self.entries[i].clone();
            if self.cache.contains_key(&entry) {
                log::debug!("Hit cache so skip preload index: {}", i);
                continue;
            }

            self.load_image(&entry)?;
        }
        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError> {
        Ok(self.cache.get(entry).map(|arc| Arc::clone(arc)))
    }
}

impl DirectoryContainer {
    pub fn new(path: &String) -> Result<Self, ContainerError> {
        let dir_entries = read_dir(path).map_err(|e| ContainerError {
            message: e.to_string(),
            path: Some(path.clone()),
            entry: None,
        })?;

        let mut entries: Vec<String> = Vec::new();
        for entry in dir_entries {
            let entry = entry.map_err(|e| ContainerError {
                message: e.to_string(),
                path: Some(path.clone()),
                entry: None,
            })?;
            let file_type = entry.file_type().map_err(|e| ContainerError {
                message: e.to_string(),
                path: Some(path.clone()),
                entry: None,
            })?;

            if file_type.is_dir() {
                continue;
            }
            let file_name = entry
                .file_name()
                .into_string()
                .map_err(|e| ContainerError {
                    message: format!("failed to get file name from DirEntry. {}", e.display()),
                    path: Some(path.clone()),
                    entry: None,
                })?;

            if file_name.ends_with(".png")
                || file_name.ends_with(".jpg")
                || file_name.ends_with(".jpeg")
                || file_name.ends_with(".webp")
                || file_name.ends_with(".avif")
            {
                entries.push(file_name);
            }
        }

        entries.sort();

        Ok(Self {
            path: path.clone(),
            entries: entries,
            cache: HashMap::new(),
        })
    }

    fn load_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        let file_path = path::Path::new(&self.path).join(entry);
        let mut buffer = Vec::new();
        File::open(file_path)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to open the image file. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?
            .read_to_end(&mut buffer)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to read the image file. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        match Image::new(buffer) {
            Ok(image) => {
                let image_arc = Arc::new(image);
                self.cache.insert(entry.clone(), Arc::clone(&image_arc));
                Ok(image_arc)
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
}
