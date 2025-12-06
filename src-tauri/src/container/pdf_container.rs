use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use pdfium::{PdfiumDocument, PdfiumRenderConfig};
use std::{collections::HashMap, sync::Arc};

use crate::container::{
    container::{Container, ContainerError},
    image::Image,
};

/// A container for PDF archives.
pub struct PdfContainer {
    /// The file path of the container.
    path: String,
    /// The entries in the container.
    entries: Vec<String>,
    /// Image data cache (key: entry name, value: image).
    cache: HashMap<String, Arc<Image>>,
    /// The image height when rendering a PDF.
    pub rendering_height: i32,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            return Ok(Arc::clone(&image_arc));
        }

        let pdf = open(&self.path)?;
        let index: i32 = entry.parse().map_err(|e| ContainerError {
            message: format!("Failed to convet to index({}). {}", entry, e),
            path: Some(self.path.clone()),
            entry: Some(entry.clone()),
        })?;

        let render_config = PdfiumRenderConfig::new().with_height(self.rendering_height);
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
        let render_config = PdfiumRenderConfig::new().with_height(self.rendering_height);

        for i in begin_index..end {
            // If it's already in the cache, skip it.
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
    /// Creates a new instance.
    ///
    /// * `path` - The path to the container file.
    /// * `rendering_height` - The image height when rendering a PDF.
    pub fn new(path: &String, rendering_height: i32) -> Result<Self, ContainerError> {
        let pdf = open(path)?;
        let mut entries: Vec<String> = Vec::new();
        for index in 0..pdf.pages().page_count() {
            entries.push(format!("{:0>4}", index));
        }

        Ok(Self {
            path: path.clone(),
            entries: entries,
            cache: HashMap::new(),
            rendering_height,
        })
    }
}

/// Opens a PDF document from the specified path.
///
/// * `path` - The path to the PDF file.
fn open(path: &String) -> Result<PdfiumDocument, ContainerError> {
    let pdf = PdfiumDocument::new_from_path(path, None).map_err(|e| ContainerError {
        message: String::from(format!("Failed to open the pdf file. {}", e)),
        path: Some(path.clone()),
        entry: None,
    })?;

    Ok(pdf)
}

#[cfg(test)]
mod tests {
    use std::{env, fs::File, io::Write, path, sync::Once};
    use tempfile::tempdir;

    use super::*;

    static INIT: Once = Once::new();

    pub fn setup() {
        INIT.call_once(|| {
            let pdfium_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join("dependencies")
                .join("pdfium");

            let lib_path = if pdfium_path.clone().join("bin").exists() {
                pdfium_path.clone().join("bin")
            } else {
                pdfium_path.clone().join("lib")
            };
            print!("pdfium::set_library_location: {:?}", lib_path);
            pdfium::set_library_location(lib_path.to_str().unwrap());
        });
    }

    // A minimal 1-page PDF file content
    const SINGLE_PAGE_PDF_DATA: &[u8] = b"%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count 1 /Kids [ 3 0 R ] >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000057 00000 n\n0000000107 00000 n\ntrailer << /Size 4 /Root 1 0 R >> startxref\n157\n%%EOF\n";

    // Create a dummy PDF file for testing.
    fn create_dummy_pdf(dir: &path::Path, filename: &str) -> path::PathBuf {
        let filepath = dir.join(filename);
        let mut file = File::create(&filepath).unwrap();
        file.write_all(SINGLE_PAGE_PDF_DATA).unwrap();
        filepath
    }

    #[test]
    fn test_new_valid_pdf() {
        setup();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let rendering_height = 100;

        let container =
            PdfContainer::new(&pdf_path.to_str().unwrap().to_string(), rendering_height).unwrap();

        assert_eq!(container.path, pdf_path.to_str().unwrap());
        assert_eq!(container.entries.len(), 1);
        assert_eq!(container.entries[0], "0000");
        assert_eq!(container.rendering_height, rendering_height);
    }

    #[test]
    fn test_new_non_existent_pdf() {
        setup();
        let non_existent_path = String::from("/non/existent/file.pdf");
        let container = PdfContainer::new(&non_existent_path, 100);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        setup();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let container = PdfContainer::new(&pdf_path.to_str().unwrap().to_string(), 100).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0], "0000");
    }

    #[test]
    fn test_get_image_existing() {
        setup();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let rendering_height = 100;
        let mut container =
            PdfContainer::new(&pdf_path.to_str().unwrap().to_string(), rendering_height).unwrap();

        let image = container.get_image(&String::from("0000")).unwrap();
        // The exact width/height depends on the PDF content and rendering, but we can check if they are non-zero
        assert!(image.width > 0);
        assert!(image.height > 0);
        assert!(!image.data.is_empty());

        // Ensure caching works
        let image_from_cache = container
            .get_image_from_cache(&String::from("0000"))
            .unwrap()
            .unwrap();
        assert_eq!(image.data, image_from_cache.data);
    }

    #[test]
    fn test_get_image_non_existing() {
        setup();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let mut container =
            PdfContainer::new(&pdf_path.to_str().unwrap().to_string(), 100).unwrap();
        let result = container.get_image(&String::from("0001")); // Page 1 does not exist
        assert!(result.is_err());
    }

    #[test]
    fn test_preload() {
        setup();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let rendering_height = 100;
        let mut container =
            PdfContainer::new(&pdf_path.to_str().unwrap().to_string(), rendering_height).unwrap();

        // Preload the only page
        container.preload(0, 1).unwrap();

        assert!(container.cache.contains_key(&String::from("0000")));

        // Ensure getting a preloaded image works
        let image = container.get_image(&String::from("0000")).unwrap();
        assert!(image.width > 0);

        // Preload again, should not cause issues
        container.preload(0, 1).unwrap();
        assert!(container.cache.contains_key(&String::from("0000")));
    }

    #[test]
    fn test_preload_out_of_bounds() {
        setup();
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let rendering_height = 100;
        let mut container =
            PdfContainer::new(&pdf_path.to_str().unwrap().to_string(), rendering_height).unwrap();

        // Attempt to preload beyond the number of entries
        container.preload(0, 5).unwrap();
        assert!(container.cache.contains_key(&String::from("0000")));
        assert_eq!(container.cache.len(), 1);

        container.preload(1, 1).unwrap(); // Should not add anything new
        assert_eq!(container.cache.len(), 1);
    }
}
