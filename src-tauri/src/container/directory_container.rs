use std::{
    collections::HashMap,
    fs::{read_dir, File},
    io::Read,
    path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use threadpool::ThreadPool;

use crate::container::{
    container::{self, Container, ContainerError, ContainerResult},
    image::Image,
};

/// A container for directories.
pub struct DirectoryContainer {
    /// The directory path.
    path: String,
    /// The entries in the directory.
    entries: Vec<String>,
    /// The image cache.(key: entry name, value: image)
    cache: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    /// Thread pool for preloading.
    thread_pool: ThreadPool,
    /// Whether is preloading cancel requested.
    is_preloading_cancel_requested: Arc<AtomicBool>,
}

impl Container for DirectoryContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> ContainerResult<Arc<Image>> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            log::debug!("Hit cache: {}", entry);
            return Ok(Arc::clone(&image_arc));
        }

        let image_arc = load_image(&self.path, entry)?;
        self.cache
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .insert(entry.clone(), image_arc.clone());

        Ok(image_arc)
    }

    fn request_preload(&mut self, begin_index: usize, count: usize) -> ContainerResult<()> {
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

    fn get_image_from_cache(&self, entry: &String) -> ContainerResult<Option<Arc<Image>>> {
        Ok(self
            .cache
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .get(entry)
            .map(|arc| Arc::clone(arc)))
    }
}

impl Drop for DirectoryContainer {
    fn drop(&mut self) {
        // Requests preloading cancel and waits for all threads to finish.
        if !self.is_preloading_cancel_requested.load(Ordering::Relaxed) {
            self.is_preloading_cancel_requested
                .store(true, Ordering::Relaxed);
        }
        self.thread_pool.join();
    }
}

impl DirectoryContainer {
    /// Creates a new DirectoryContainer.
    ///
    /// * `path` - The directory path.
    pub fn new(path: &String) -> ContainerResult<Self> {
        let dir_entries = read_dir(path)?;

        let mut entries: Vec<String> = Vec::new();
        for entry_result in dir_entries {
            let entry = entry_result?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                continue;
            }
            let file_name = entry.file_name().into_string().map_err(|e| {
                ContainerError::Other(format!(
                    "failed to get file name from DirEntry. {}",
                    e.display()
                ))
            })?;

            if Image::is_supported_format(&file_name) {
                entries.push(file_name);
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

/// Loads an image from the specified entry name.
///
/// * `path` - The path of the container directory.
/// * `entry` - The entry name of the image to get.
fn load_image(path: &String, entry: &String) -> ContainerResult<Arc<Image>> {
    let file_path = path::Path::new(&path).join(entry);
    let mut buffer = Vec::new();
    File::open(file_path)?.read_to_end(&mut buffer)?;

    Ok(Arc::new(Image::new(buffer)?))
}

fn preload(
    begin_index: usize,
    end: usize,
    path: String,
    entries: Vec<String>,
    cache_mutex: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    is_cancel_requested: Arc<AtomicBool>,
) -> ContainerResult<()> {
    for i in begin_index..end {
        if is_cancel_requested.load(Ordering::Relaxed) {
            return Ok(());
        }

        let entry = entries[i].clone();

        // If it's already in the cache, skip it.
        if cache_mutex
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .contains_key(&entry)
        {
            log::debug!("Hit cache so skip preload index: {}", i);
            continue;
        }

        let image_arc = load_image(&path, &entry)?;
        cache_mutex
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .insert(entry.clone(), image_arc.clone());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File},
        io::Write,
        thread::sleep,
        time::Duration,
    };

    use rstest::rstest;
    use tempfile::tempdir;

    use super::*;

    // Create a dummy image file for testing.
    fn create_dummy_image(dir: &path::Path, filename: &str) -> path::PathBuf {
        let filepath = dir.join(filename);
        let mut file = File::create(&filepath).expect("failed to create dummy image file");
        // A minimal valid PNG (1x1 transparent pixel)
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC,
            0x53, 0x24, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        file.write_all(&png_data).expect("failed to write png data");
        filepath
    }

    #[test]
    fn test_new_valid_directory() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "test1.png");
        create_dummy_image(dir.path(), "test2.jpg");
        fs::File::create(dir.path().join("test.txt")).expect("failed to create test.txt"); // Not supported

        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "test1.png");
        assert_eq!(container.entries[1], "test2.jpg");
    }

    #[test]
    fn test_new_empty_directory() {
        let dir = tempdir().expect("failed to create tempdir");
        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
        assert!(container.entries.is_empty());
    }

    #[test]
    fn test_new_non_existent_directory() {
        let non_existent_path = String::from("/non/existent/path");
        let container = DirectoryContainer::new(&non_existent_path);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "a.png");
        create_dummy_image(dir.path(), "b.jpg");

        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
        let entries = container.get_entries();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0], "a.png");
        assert_eq!(entries[1], "b.jpg");
    }

    #[rstest]
    #[case(vec!["b.png", "a.jpg"], vec!["a.jpg", "b.png"])]
    #[case(vec!["10.png", "2.png", "1.png"], vec!["1.png", "2.png", "10.png"])]
    fn test_get_entries_sorted(
        #[case] unsorted_files: Vec<&str>,
        #[case] expected_sorted_files: Vec<&str>,
    ) {
        let dir = tempdir().expect("failed to create tempdir");
        for file in unsorted_files {
            create_dummy_image(dir.path(), file);
        }

        let container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
        let entries = container.get_entries();

        let expected_sorted_strings: Vec<String> = expected_sorted_files
            .into_iter()
            .map(String::from)
            .collect();

        assert_eq!(entries, &expected_sorted_strings);
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "test.png");
        let mut container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");

        let image = container
            .get_image(&String::from("test.png"))
            .expect("get_image should succeed for existing image");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);

        // Ensure caching works
        let image_from_cache = container
            .get_image_from_cache(&String::from("test.png"))
            .expect("get_image_from_cache returned Err")
            .expect("image should be present in cache");
        assert_eq!(image.data, image_from_cache.data);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().expect("failed to create tempdir");
        let mut container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");
        let result = container.get_image(&String::from("non_existent.png"));
        assert!(result.is_err());
    }

    #[test]
    fn test_preload() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "1.png");
        create_dummy_image(dir.path(), "2.png");
        create_dummy_image(dir.path(), "3.png");

        let mut container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");

        // Preload first two images
        container.request_preload(0, 2).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("1.png")));
        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("2.png")));
        assert!(!container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("3.png")));

        // Ensure getting a preloaded image works
        let image_1 = container.get_image(&String::from("1.png")).unwrap();
        assert_eq!(image_1.width, 1);

        // Preload the remaining image
        container.request_preload(2, 1).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("3.png")));
    }

    #[test]
    fn test_preload_out_of_bounds() {
        let dir = tempdir().expect("failed to create tempdir");
        create_dummy_image(dir.path(), "1.png");
        let mut container = DirectoryContainer::new(&dir.path().to_string_lossy().to_string())
            .expect("failed to create DirectoryContainer");

        // Attempt to preload beyond the number of entries
        container.request_preload(0, 5).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .expect("failed to lock cache")
            .contains_key(&String::from("1.png")));
        assert_eq!(
            container.cache.lock().expect("failed to lock cache").len(),
            1
        );

        container.request_preload(1, 1).unwrap(); // Should not add anything new

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert_eq!(
            container.cache.lock().expect("failed to lock cache").len(),
            1
        );
    }
}
