use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
use pdfium_render::prelude::{PdfDocument, PdfRenderConfig, Pdfium};
use std::{
    collections::HashMap,
    fs::File,
    io::Read,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use threadpool::ThreadPool;

use crate::container::{
    container::{self, Container, ContainerError},
    image::Image,
};

/// A container for PDF archives.
pub struct PdfContainer {
    /// The file path of the container.
    path: String,
    /// Pdf binary data.
    pdf_binary: Vec<u8>,
    /// The entries in the container.
    entries: Vec<String>,
    /// Image data cache (key: entry name, value: image).
    cache: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    /// Thread pool for preloading.
    thread_pool: ThreadPool,
    /// Whether is preloading cancel requested.
    is_preloading_cancel_requested: Arc<AtomicBool>,
    /// Pdf rendering config.
    render_config: Arc<PdfRenderConfig>,
    /// The path to the pdfium library.
    library_path: Option<String>,
}

impl Container for PdfContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            log::debug!("Hit cache: {}", entry);
            return Ok(Arc::clone(&image_arc));
        }

        let pdfium = get_pdfium(&self.library_path)?;
        let pdf = pdfium
            .load_pdf_from_byte_slice(&self.pdf_binary, None)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to load the Pdf binary data. {}", e)),
                path: Some(self.path.clone()),
                entry: None,
            })?;

        let image_arc = load_image(&self.path, entry, &pdf, &self.render_config)?;

        self.cache
            .lock()
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to lock the cache. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?
            .insert(entry.clone(), Arc::clone(&image_arc));
        Ok(image_arc)
    }

    fn request_preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError> {
        let total_pages = self.entries.len();
        let end = (begin_index + count).min(total_pages);

        if begin_index >= end {
            return Ok(());
        }

        let path = self.path.clone();
        let entries = self.entries.clone();
        let cache_mutex = self.cache.clone();
        let is_cancel_requested = self.is_preloading_cancel_requested.clone();
        let render_config = self.render_config.clone();
        let pdf_binary = self.pdf_binary.clone();
        let library_path = self.library_path.clone();

        self.thread_pool.execute(move || {
            match preload(
                begin_index,
                end,
                path,
                entries,
                pdf_binary,
                &render_config,
                &library_path,
                cache_mutex,
                is_cancel_requested,
            ) {
                Ok(_) => {
                    log::debug!("Finished preloading from {} to {}", begin_index, end);
                }
                Err(e) => {
                    log::error!("Error in preloading: {}", e);
                }
            }
        });

        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError> {
        Ok(self
            .cache
            .lock()
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to lock the cache. {}", e)),
                path: Some(self.path.clone()),
                entry: Some(entry.clone()),
            })?
            .get(entry)
            .map(|arc| Arc::clone(arc)))
    }
}

impl Drop for PdfContainer {
    fn drop(&mut self) {
        // Requests preloading cancel and waits for all threads to finish.
        if !self.is_preloading_cancel_requested.load(Ordering::Relaxed) {
            self.is_preloading_cancel_requested
                .store(true, Ordering::Relaxed);
        }
        self.thread_pool.join();
    }
}

impl PdfContainer {
    /// Creates a new instance.
    ///
    /// * `path` - The path to the container file.
    /// * `render_config` - The pdf rendering config.
    /// * `library_path` - The path to the pdfium library. Uses default path if None.
    pub fn new(
        path: &String,
        render_config: PdfRenderConfig,
        library_path: Option<String>,
    ) -> Result<Self, ContainerError> {
        let mut buffer = Vec::new();
        {
            File::open(path)
                .map_err(|e| ContainerError {
                    message: String::from(format!("Failed to open the pdf file. {}", e)),
                    path: Some(path.clone()),
                    entry: None,
                })?
                .read_to_end(&mut buffer)
                .map_err(|e| ContainerError {
                    message: String::from(format!("Failed to read the pdf file. {}", e)),
                    path: Some(path.clone()),
                    entry: None,
                })?;
        }

        let mut entries: Vec<String> = Vec::new();
        {
            let pdfium = get_pdfium(&library_path)?;
            let pdf = pdfium
                .load_pdf_from_byte_slice(&buffer, None)
                .map_err(|e| ContainerError {
                    message: String::from(format!("Failed to load the Pdf binary data. {}", e)),
                    path: Some(path.clone()),
                    entry: None,
                })?;

            for index in 0..pdf.pages().len() {
                entries.push(format!("{:0>4}", index));
            }
        }

        Ok(Self {
            path: path.clone(),
            pdf_binary: buffer,
            entries: entries,
            cache: Arc::new(Mutex::new(HashMap::new())),
            thread_pool: ThreadPool::new(container::NUM_OF_THREADS),
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
            render_config: Arc::new(render_config),
            library_path: library_path.clone(),
        })
    }
}

/// Loads an image from the specified entry name.
///
/// * `path` - The path of the pdf file.
/// * `entry` - The entry name of the image to get.
/// * `pdf` - The pdf document.
/// * `render_config` - The pdf rendering config.
fn load_image(
    path: &String,
    entry: &String,
    pdf: &PdfDocument,
    render_config: &PdfRenderConfig,
) -> Result<Arc<Image>, ContainerError> {
    let index: u16 = entry.parse().map_err(|e| ContainerError {
        message: format!("Failed to convet to index({}). {}", entry, e),
        path: Some(path.clone()),
        entry: Some(entry.clone()),
    })?;

    let page = pdf.pages().get(index).map_err(|e| ContainerError {
        message: format!("Failed to get the pdf page({}). {}", entry, e),
        path: Some(path.clone()),
        entry: Some(entry.clone()),
    })?;
    let img = page
        .render_with_config(render_config)
        .map_err(|e| ContainerError {
            message: format!("Failed to render the pdf page({}). {}", entry, e),
            path: Some(path.clone()),
            entry: Some(entry.clone()),
        })?
        .as_image();

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
            path: Some(path.clone()),
            entry: Some(entry.clone()),
        })?;

    let image = Image {
        data: buffer,
        width: img.width(),
        height: img.height(),
    };

    Ok(Arc::new(image))
}

fn preload(
    begin_index: usize,
    end: usize,
    path: String,
    entries: Vec<String>,
    pdf_binary: Vec<u8>,
    render_config: &PdfRenderConfig,
    library_path: &Option<String>,
    cache_mutex: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    is_cancel_requested: Arc<AtomicBool>,
) -> Result<(), ContainerError> {
    for i in begin_index..end {
        if is_cancel_requested.load(Ordering::Relaxed) {
            return Ok(());
        }

        // If it's already in the cache, skip it.
        let entry = &entries[i];
        if cache_mutex
            .lock()
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to lock the cache. {}", e)),
                path: Some(path.clone()),
                entry: Some(entry.clone()),
            })?
            .contains_key(entry)
        {
            log::debug!("Hit cache so skip preload index: {}", i);
            continue;
        }

        // Pdfium is designed to operate in a single-threaded manner,
        // which means that as long as an instance exists, it blocks or prevents other executions.
        // Therefore, the Pdfium instance is instantiated and destroyed every time a load operation is performed.
        let pdfium = get_pdfium(&library_path)?;
        let pdf = pdfium
            .load_pdf_from_byte_slice(&pdf_binary, None)
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to load the Pdf binary data. {}", e)),
                path: Some(path.clone()),
                entry: None,
            })?;
        let image_arc = load_image(&path, entry, &pdf, &render_config)?;

        cache_mutex
            .lock()
            .map_err(|e| ContainerError {
                message: String::from(format!("Failed to lock the cache. {}", e)),
                path: Some(path.clone()),
                entry: Some(entry.clone()),
            })?
            .insert(entry.clone(), image_arc);
    }

    Ok(())
}

/// Gets a pdfium instance.
///
/// * `library_path` - The path to the pdfium library. Uses default path if None.
fn get_pdfium(library_path: &Option<String>) -> Result<Pdfium, ContainerError> {
    if let Some(lib_path) = library_path {
        Ok(Pdfium::new(
            Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(lib_path))
                .map_err(|e| ContainerError {
                    message: String::from(format!("Failed to load the pdfium library. {}", e)),
                    path: Some(lib_path.clone()),
                    entry: None,
                })?,
        ))
    } else {
        Ok(Pdfium::default())
    }
}

#[cfg(test)]
mod tests {
    use std::{env, fs::File, io::Write, path, thread::sleep, time::Duration};
    use tempfile::tempdir;

    use super::*;

    pub fn get_pdfium_lib_path() -> String {
        let pdfium_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("dependencies")
            .join("pdfium");

        let lib_path = if pdfium_path.clone().join("bin").exists() {
            pdfium_path.clone().join("bin")
        } else {
            pdfium_path.clone().join("lib")
        };

        lib_path.to_string_lossy().to_string()
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
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let render_config = PdfRenderConfig::default();
        let container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        assert_eq!(container.path, pdf_path.to_string_lossy().to_string());
        assert_eq!(container.entries.len(), 1);
        assert_eq!(container.entries[0], "0000");
    }

    #[test]
    fn test_new_non_existent_pdf() {
        let non_existent_path = String::from("/non/existent/file.pdf");
        let render_config = PdfRenderConfig::default();
        let container = PdfContainer::new(
            &non_existent_path,
            render_config,
            Some(get_pdfium_lib_path()),
        );

        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");
        let render_config = PdfRenderConfig::default();
        let container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0], "0000");
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let rendering_height: u32 = 100;
        let render_config = PdfRenderConfig::default().set_target_height(rendering_height as i32);
        let mut container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let image = container.get_image(&String::from("0000")).unwrap();

        assert!(image.width > 0);
        assert_eq!(rendering_height, image.height);
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
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let rendering_height = 100;
        let render_config = PdfRenderConfig::default().set_target_height(rendering_height);
        let mut container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        let result = container.get_image(&String::from("0001")); // Page 1 does not exist
        assert!(result.is_err());
    }

    #[test]
    fn test_preload() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let rendering_height: u32 = 100;
        let render_config = PdfRenderConfig::default().set_target_height(rendering_height as i32);
        let mut container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        // Preload the only page
        container.request_preload(0, 1).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("0000")));

        // Ensure getting a preloaded image works
        let image = container.get_image(&String::from("0000")).unwrap();
        assert!(image.width > 0);
        assert_eq!(rendering_height, image.height);
        assert!(!image.data.is_empty());

        // Preload again, should not cause issues
        container.request_preload(0, 1).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("0000")));
    }

    #[test]
    fn test_preload_out_of_bounds() {
        let dir = tempdir().unwrap();
        let pdf_path = create_dummy_pdf(dir.path(), "test.pdf");

        let rendering_height = 100;
        let render_config = PdfRenderConfig::default().set_target_height(rendering_height);
        let mut container = PdfContainer::new(
            &pdf_path.to_string_lossy().to_string(),
            render_config,
            Some(get_pdfium_lib_path()),
        )
        .unwrap();

        // Attempt to preload beyond the number of entries
        container.request_preload(0, 5).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("0000")));
        assert_eq!(container.cache.lock().unwrap().len(), 1);

        container.request_preload(1, 1).unwrap(); // Should not add anything new

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert_eq!(container.cache.lock().unwrap().len(), 1);
    }
}
