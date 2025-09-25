use std::{collections::HashMap, path::Path};

use crate::container::{
    container::{Container, ContainerError, Image},
    pdf_container::PdfContainer,
    zip_container::ZipContainer,
};

pub enum ContainerFormat {
    ZipArchive,
    PdfDocument,
    Unsupported = 0xFFFF,
}

pub struct ContainerState {
    pub path: String,
    pub format: ContainerFormat,
    pub entries: Vec<String>,
    // 画像データのキャッシュ (キー: ページインデックス, 値: 画像バイナリ)
    pub cache: HashMap<String, Image>,
}

impl ContainerState {
    pub fn new() -> Self {
        Self {
            path: String::from(""),
            format: ContainerFormat::Unsupported,
            entries: Vec::new(),
            cache: HashMap::new(),
        }
    }

    pub fn open_container(&mut self, path: &String) -> Result<(), ContainerError> {
        self.cache.clear();
        if let Some(ext) = Path::new(path).extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "zip" => {
                    let zip = ZipContainer::new(path);
                    self.path = path.clone();
                    self.format = ContainerFormat::ZipArchive;
                    self.entries = zip.get_entries()?;
                    Ok(())
                }
                "pdf" => {
                    let pdf = PdfContainer::new(path);
                    self.path = path.clone();
                    self.format = ContainerFormat::PdfDocument;
                    self.entries = pdf.get_entries()?;
                    Ok(())
                }
                _ => {
                    self.path = path.clone();
                    self.format = ContainerFormat::Unsupported;
                    self.entries.clear();
                    log::error!("Unsupported Container Type: {}", ext_str);
                    Err({
                        ContainerError {
                            message: format!("Unsupported Container Type: {}", ext_str),
                            path: Some(path.clone()),
                            entry: None,
                        }
                    })
                }
            }
        } else {
            log::error!("Failed to get extension. {}", path);
            Err({
                ContainerError {
                    message: format!("Failed to get extension. {}", path),
                    path: Some(path.clone()),
                    entry: None,
                }
            })
        }
    }

    pub fn get_image(&mut self, entry: &String) -> Result<Image, ContainerError> {
        // まずキャッシュを確認
        if let Some(cache) = self.cache.get(entry) {
            log::debug!("Hit cache so get_image() returns cache of {}", entry);
            return Ok(Image {
                data: cache.data.clone(),
                width: cache.width,
                height: cache.height,
            });
        }

        let img = match self.format {
            ContainerFormat::ZipArchive => {
                let img = ZipContainer::new(&self.path).get_image(entry)?;
                self.cache.insert(
                    entry.clone(),
                    Image {
                        data: img.data.clone(),
                        width: img.width,
                        height: img.height,
                    },
                );
                Some(img)
            }
            ContainerFormat::PdfDocument => {
                let img = PdfContainer::new(&self.path).get_image(entry)?;
                self.cache.insert(
                    entry.clone(),
                    Image {
                        data: img.data.clone(),
                        width: img.width,
                        height: img.height,
                    },
                );
                Some(img)
            }
            _ => {
                log::error!("Unsupported Container Type");
                None
            }
        };

        match img {
            Some(img) => Ok(img),
            None => Err({
                ContainerError {
                    message: format!("Unsupported Container Type."),
                    path: Some(self.path.clone()),
                    entry: None,
                }
            }),
        }
    }

    pub fn preload(&mut self, start_index: usize, count: usize) -> Result<(), ContainerError> {
        match self.format {
            ContainerFormat::ZipArchive => {
                return Ok(ZipContainer::new(&self.path).preload(
                    &mut self.cache,
                    &self.entries,
                    start_index,
                    count,
                )?);
            }
            ContainerFormat::PdfDocument => {
                return Ok(PdfContainer::new(&self.path).preload(
                    &mut self.cache,
                    &self.entries,
                    start_index,
                    count,
                )?);
            }
            _ => {
                return Err({
                    ContainerError {
                        message: format!("Unsupported Container Type"),
                        path: Some(self.path.clone()),
                        entry: None,
                    }
                });
            }
        };
    }
}
