use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use pdfium::{PdfiumDocument, PdfiumRenderConfig};
use std::{collections::HashMap, sync::Arc};

use crate::container::container::{Container, ContainerError, Image};

/// PDF 書庫コンテナー
pub struct PdfContainer {
    /// コンテナーのファイルパス
    path: String,
    /// コンテナー内のエントリー
    entries: Vec<String>,
    /// 画像データのキャッシュ (キー: ページインデックス, 値: 画像バイナリ)
    cache: HashMap<String, Arc<Image>>,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // まずはキャッシュから取得する
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            return Ok(Arc::clone(&image_arc));
        }

        let pdf = open(&self.path)?;
        let index: i32 = entry.parse().map_err(|e| ContainerError {
            message: format!("Failed to convet to index({}). {}", entry, e),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;

        let render_config = PdfiumRenderConfig::new().with_height(2000);
        let page = pdf.pages().get(index).map_err(|e| ContainerError {
            message: format!("Failed to get the pdf page({}). {}", entry, e),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;
        let img = page
            .render(&render_config)
            .map_err(|e| ContainerError {
                message: format!("Failed to render the pdf page({}). {}", entry, e),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?
            .as_rgb8_image()
            .map_err(|e| ContainerError {
                message: format!("Failed to convert the pdf page({}) to rgb8. {}", entry, e),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        let mut buffer = Vec::new();
        let encoder = PngEncoder::new(&mut buffer);
        encoder
            .write_image(
                &img.as_bytes(),
                img.width(),
                img.height(),
                ExtendedColorType::from(img.color()),
            )
            .map_err(|e| ContainerError {
                message: format!("Failed to convert the pdf page({}) to rgb8. {}", entry, e),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        let image = Image {
            data: buffer,
            width: img.width(),
            height: img.height(),
        };

        let image_arc = Arc::new(image);
        self.cache.insert(entry.clone(), Arc::clone(&image_arc));
        Ok(image_arc)
    }

    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        if begin_index >= end {
            return Ok(());
        }

        let pdf = open(&self.path)?;
        let render_config = PdfiumRenderConfig::new().with_height(2000);

        for i in begin_index..end {
            // すでにキャッシュにあればスキップ
            let entry = &self.entries[i];
            if self.cache.contains_key(entry) {
                log::debug!("Hit cache so skip preload index: {}", i);
                continue;
            }

            let page = pdf
                .pages()
                .get(i.try_into().unwrap())
                .map_err(|e| ContainerError {
                    message: format!("Failed to get the pdf page({}). {}", entry, e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            let img = page
                .render(&render_config)
                .map_err(|e| ContainerError {
                    message: format!("Failed to render the pdf page({}). {}", entry, e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?
                .as_rgb8_image()
                .map_err(|e| ContainerError {
                    message: format!("Failed to convert the pdf page({}) to rgb8. {}", entry, e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;

            let mut buffer = Vec::new();
            let encoder = PngEncoder::new(&mut buffer);
            encoder
                .write_image(
                    &img.as_bytes(),
                    img.width(),
                    img.height(),
                    ExtendedColorType::from(img.color()),
                )
                .map_err(|e| ContainerError {
                    message: format!("Failed to convert the pdf page({}) to rgb8. {}", entry, e),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            let image = Image {
                data: buffer,
                width: img.width(),
                height: img.height(),
            };

            self.cache.insert(entry.clone(), Arc::new(image));
        }

        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError> {
        Ok(self.cache.get(entry).map(|arc| Arc::clone(arc)))
    }
}

impl PdfContainer {
    /// インスタンスを生成する
    ///
    /// * `path` - コンテナーファイルのパス
    pub fn new(path: &String) -> Result<Self, ContainerError> {
        let pdf = open(path)?;
        let mut entries: Vec<String> = Vec::new();
        for index in 0..pdf.pages().page_count() {
            entries.push(format!("{:0>4}", index));
        }

        Ok(Self {
            path: path.clone(),
            entries: entries,
            cache: HashMap::new(),
        })
    }
}

fn open(path: &String) -> Result<PdfiumDocument, ContainerError> {
    let pdf = PdfiumDocument::new_from_path(path, None).map_err(|e| ContainerError {
        message: String::from(format!("Failed to open the pdf file. {}", e)),
        path: Some(path.clone()),
        entry: None,
    })?;

    Ok(pdf)
}
