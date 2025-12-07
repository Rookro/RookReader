use threadpool::ThreadPool;
use unrar::{Archive, CursorBeforeHeader, OpenArchive, Process};

use std::{
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use crate::container::{
    container::{self, Container, ContainerError},
    image::Image,
};

/// A container for RAR archives.
pub struct RarContainer {
    /// The file path of the container.
    path: String,
    /// The entries in the container.
    entries: Vec<String>,
    /// Image data cache (key: entry name, value: image).
    cache: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    /// Thread pool for preloading.
    thread_pool: ThreadPool,
    /// Whether is preloading cancel requested.
    is_preloading_cancel_requested: Arc<AtomicBool>,
}

impl Container for RarContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            log::debug!("Hit cache: {}", entry);
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
                        self.cache
                            .lock()
                            .map_err(|e| ContainerError {
                                message: String::from(format!("Failed to lock the cache. {}", e)),
                                path: Some(self.path.clone()),
                                entry: Some(entry.clone()),
                            })?
                            .insert(entry.clone(), Arc::clone(&img_arc));
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

        self.thread_pool.execute(move || {
            match preload(
                begin_index,
                end,
                path,
                entries,
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

impl Drop for RarContainer {
    fn drop(&mut self) {
        // Requests preloading cancel and waits for all threads to finish.
        if !self.is_preloading_cancel_requested.load(Ordering::Relaxed) {
            self.is_preloading_cancel_requested
                .store(true, Ordering::Relaxed);
        }
        self.thread_pool.join();
    }
}

impl RarContainer {
    /// Creates a new instance.
    ///
    /// * `path` - The path to the container file.
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
                let filename = entry.filename.as_os_str().to_string_lossy().to_string();
                if Image::is_supported_format(&filename) {
                    entries.push(filename);
                }
            }
        }

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            path: path.clone(),
            entries: entries,
            cache: Arc::new(Mutex::new(HashMap::new())),
            thread_pool: ThreadPool::new(container::NUM_OF_THREADS),
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
        })
    }
}

/// Opens a RAR archive from the specified path.
///
/// * `path` - The path to the RAR file.
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

fn preload(
    begin_index: usize,
    end: usize,
    path: String,
    entries: Vec<String>,
    cache_mutex: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    is_cancel_requested: Arc<AtomicBool>,
) -> Result<(), ContainerError> {
    let target_names: HashSet<String> = entries[begin_index..end].iter().cloned().collect();
    let mut remaining = target_names.len();

    let mut archive = open(&path)?;
    while let Some(header) = archive.read_header().map_err(|e| ContainerError {
        message: format!("Failed to read header. {}", e),
        path: Some(path.clone()),
        entry: None,
    })? {
        if is_cancel_requested.load(Ordering::Relaxed) {
            return Ok(());
        }

        let filename = header
            .entry()
            .filename
            .as_os_str()
            .to_string_lossy()
            .to_string();
        if target_names.contains(&filename) {
            if cache_mutex
                .lock()
                .map_err(|e| ContainerError {
                    message: String::from(format!("Failed to lock the cache. {}", e)),
                    path: Some(path.clone()),
                    entry: Some(filename.clone()),
                })?
                .contains_key(&filename)
            {
                archive = header.skip().map_err(|e| ContainerError {
                    message: format!("Failed to skip data in the rar. {}", e),
                    path: Some(path.clone()),
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
                path: Some(path.clone()),
                entry: Some(filename.clone()),
            })?;
            archive = rest; // continue from returned archive

            match Image::new(data) {
                Ok(img) => {
                    cache_mutex
                        .lock()
                        .map_err(|e| ContainerError {
                            message: String::from(format!("Failed to lock the cache. {}", e)),
                            path: Some(path.clone()),
                            entry: Some(filename.clone()),
                        })?
                        .insert(filename.clone(), Arc::new(img));
                    remaining = remaining.saturating_sub(1);
                    if remaining == 0 {
                        break;
                    }
                }
                Err(e) => {
                    log::error!("{}", e);
                    return Err(ContainerError {
                        message: e,
                        path: Some(path.clone()),
                        entry: Some(filename.clone()),
                    });
                }
            }
        } else {
            archive = header.skip().map_err(|e| ContainerError {
                message: format!("Failed to skip data in the rar. {}", e),
                path: Some(path.clone()),
                entry: Some(filename.clone()),
            })?
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{path, thread::sleep, time::Duration};
    use tempfile::tempdir;

    use super::*;

    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8,
        0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x53, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    // Since programmatically generating a RAR file is complicated,
    // a dummy RAR file was created manually beforehand.
    //
    // This function copies that pre-existing RAR file to the path specified in the arguments.
    fn create_dummy_rar(dir: &path::Path, filename: &str) -> path::PathBuf {
        let dummy_rar_path = path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("resources")
            .join("test.rar");
        if !dummy_rar_path.exists() {
            panic!(
                "Dummy RAR file not found at {}. Please create it manually as per instructions.",
                dummy_rar_path.display()
            );
        }

        let rar_filepath = dir.join(filename);
        std::fs::copy(dummy_rar_path, &rar_filepath).unwrap();
        rar_filepath
    }

    #[test]
    fn test_new_valid_rar() {
        let dir = tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");

        let container = RarContainer::new(&rar_path.to_str().unwrap().to_string()).unwrap();

        assert_eq!(container.path, rar_path.to_str().unwrap());
        // Expecting 2 entries based on the dummy.rar creation instructions
        assert_eq!(container.entries.len(), 3);
        assert!(container.entries.contains(&String::from("image1.png")));
        assert!(container.entries.contains(&String::from("image2.png")));
        assert!(container.entries.contains(&String::from("image3.png")));
    }

    #[test]
    fn test_new_non_existent_rar() {
        let non_existent_path = String::from("/non/existent/file.rar");
        let container = RarContainer::new(&non_existent_path);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let container = RarContainer::new(&rar_path.to_str().unwrap().to_string()).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert!(entries.contains(&String::from("image1.png")));
        assert!(entries.contains(&String::from("image2.png")));
        assert!(entries.contains(&String::from("image3.png")));
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let mut container = RarContainer::new(&rar_path.to_str().unwrap().to_string()).unwrap();

        // Assuming 'image1.png' exists in dummy.rar and is a valid image
        let image = container.get_image(&String::from("image1.png")).unwrap();
        assert!(image.width > 0);
        assert!(image.height > 0);
        assert!(!image.data.is_empty());
        assert_eq!(image.data, DUMMY_PNG_DATA);

        // Ensure caching works
        let image_from_cache = container
            .get_image_from_cache(&String::from("image1.png"))
            .unwrap()
            .unwrap();
        assert_eq!(image.data, image_from_cache.data);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let mut container = RarContainer::new(&rar_path.to_str().unwrap().to_string()).unwrap();
        let result = container.get_image(&String::from("non_existent_image.png"));
        assert!(result.is_err());
    }

    #[test]
    fn test_preload() {
        let dir = tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let mut container = RarContainer::new(&rar_path.to_str().unwrap().to_string()).unwrap();

        // Preload one image
        container.request_preload(0, 1).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        // Check if one of the expected files is in cache (order might vary)
        let expected_file_1 = String::from("image1.png");
        let expected_file_2 = String::from("image2.png");
        let expected_file_3 = String::from("image3.png");
        assert!(
            container
                .cache
                .lock()
                .unwrap()
                .contains_key(&expected_file_1)
                || container
                    .cache
                    .lock()
                    .unwrap()
                    .contains_key(&expected_file_2)
        );
        assert_eq!(container.cache.lock().unwrap().len(), 1);

        // Preload the remaining image
        container.request_preload(0, 3).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&expected_file_1));
        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&expected_file_2));
        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&expected_file_3));
        assert_eq!(container.cache.lock().unwrap().len(), 3);
    }

    #[test]
    fn test_preload_out_of_bounds() {
        let dir = tempdir().unwrap();
        let rar_path = create_dummy_rar(dir.path(), "dummy.rar");
        let mut container = RarContainer::new(&rar_path.to_str().unwrap().to_string()).unwrap();

        // Attempt to preload beyond the number of entries
        container.request_preload(0, 5).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert_eq!(container.cache.lock().unwrap().len(), 3);

        // Should not add anything new
        container.request_preload(4, 5).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert_eq!(container.cache.lock().unwrap().len(), 3);
    }
}
