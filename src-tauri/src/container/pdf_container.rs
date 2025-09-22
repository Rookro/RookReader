use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use pdfium::{PdfiumDocument, PdfiumRenderConfig};
use std::collections::HashMap;

use crate::container::container::{Container, ContainerError, Image};

pub struct PdfContainer {
    path: String,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> Result<Vec<String>, ContainerError> {
        let pdf = self.open()?;
        let mut entries: Vec<String> = Vec::new();
        for index in 0..pdf.pages().page_count() {
            entries.push(format!("{:0>4}", index));
        }

        Ok(entries)
    }

    fn get_image(&self, entry: &String) -> Result<Image, ContainerError> {
        let pdf = self.open()?;
        let index: i32 = entry
            .parse()
            .map_err(|e: std::num::ParseIntError| ContainerError {
                message: format!("Failed to convet to index({}). {}", entry, e.to_string()),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;

        let render_config = PdfiumRenderConfig::new().with_height(2000);
        let page = pdf.pages().get(index).map_err(|e| ContainerError {
            message: format!("Failed to get the pdf page({}). {}", entry, e.to_string()),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;
        let img = page
            .render(&render_config)
            .map_err(|e| ContainerError {
                message: format!(
                    "Failed to render the pdf page({}). {}",
                    entry,
                    e.to_string()
                ),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?
            .as_rgb8_image()
            .map_err(|e| ContainerError {
                message: format!(
                    "Failed to convert the pdf page({}) to rgb8. {}",
                    entry,
                    e.to_string()
                ),
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
                message: format!(
                    "Failed to convert the pdf page({}) to rgb8. {}",
                    entry,
                    e.to_string()
                ),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?;
        Ok(Image {
            data: buffer,
            width: img.width(),
            height: img.height(),
        })
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

            let pdf = self.open()?;
            let render_config = PdfiumRenderConfig::new().with_height(2000);
            let page = pdf
                .pages()
                .get(i.try_into().unwrap())
                .map_err(|e| ContainerError {
                    message: format!("Failed to get the pdf page({}). {}", entry, e.to_string()),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            let img = page
                .render(&render_config)
                .map_err(|e| ContainerError {
                    message: format!(
                        "Failed to render the pdf page({}). {}",
                        entry,
                        e.to_string()
                    ),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?
                .as_rgb8_image()
                .map_err(|e| ContainerError {
                    message: format!(
                        "Failed to convert the pdf page({}) to rgb8. {}",
                        entry,
                        e.to_string()
                    ),
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
                    message: format!(
                        "Failed to convert the pdf page({}) to rgb8. {}",
                        entry,
                        e.to_string()
                    ),
                    path: Some(self.path.clone()),
                    entry: Some(entry.clone()),
                })?;
            let image = Image {
                data: buffer,
                width: img.width(),
                height: img.height(),
            };

            cache.insert(entry.clone(), image);
        }
        Ok(())
    }
}

impl PdfContainer {
    pub fn new(path: &String) -> Self {
        Self { path: path.clone() }
    }

    fn open(&self) -> Result<PdfiumDocument, ContainerError> {
        let pdf = PdfiumDocument::new_from_path(&self.path, None).map_err(|e| ContainerError {
            message: String::from(format!("Failed to open the pdf file. {}", e.to_string())),
            path: Some(self.path.clone()),
            entry: None,
        })?;

        Ok(pdf)
    }
}
