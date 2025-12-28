use std::{
    collections::HashMap,
    fs::File,
    io::{Cursor, Read},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use threadpool::ThreadPool;
use zip::ZipArchive;

use crate::container::{
    container::{self, Container, ContainerError, ContainerResult},
    image::Image,
};

/// A container for Zip archives.
pub struct ZipContainer {
    /// The Zip archive file data.
    archive_binary: Arc<Vec<u8>>,
    /// The entries in the container.
    entries: Vec<String>,
    /// Image data cache (key: entry name, value: image).
    cache: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    /// Thread pool for preloading.
    thread_pool: ThreadPool,
    /// Whether is preloading cancel requested.
    is_preloading_cancel_requested: Arc<AtomicBool>,
}

impl Container for ZipContainer {
    fn get_entries(&self) -> &Vec<String> {
        &self.entries
    }

    fn get_image(&mut self, entry: &String) -> ContainerResult<Arc<Image>> {
        // Try to get from the cache.
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            log::debug!("Hit cache: {}", entry);
            return Ok(Arc::clone(&image_arc));
        }

        let image_arc = load_image(entry, self.archive_binary.clone())?;
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

        let entries = self.entries.clone();
        let archive_binary = self.archive_binary.clone();
        let cache_mutex = self.cache.clone();
        let is_cancel_requested = self.is_preloading_cancel_requested.clone();

        self.thread_pool.execute(move || {
            if let Err(e) = preload(
                begin_index,
                end,
                entries,
                archive_binary,
                cache_mutex,
                is_cancel_requested,
            ) {
                log::error!("Error in preloading: {}", e);
            }
        });

        Ok(())
    }

    fn get_image_from_cache(&self, entry: &String) -> ContainerResult<Option<Arc<Image>>> {
        let cache = self
            .cache
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?;
        Ok(cache.get(entry).map(Arc::clone))
    }
}

impl ZipContainer {
    /// Creates a ZIP archive container from the specified path.
    ///
    /// * `path` - The path to the archive container.
    pub fn new(path: &String) -> ContainerResult<Self> {
        let mut buffer = Vec::new();
        File::open(path)?.read_to_end(&mut buffer)?;

        let archive_binary = Arc::new(buffer);
        let cursor = Cursor::new(&*archive_binary);
        let archive = ZipArchive::new(cursor)?;

        let mut entries: Vec<String> = archive
            .file_names()
            .filter(|name| Image::is_supported_format(name))
            .map(|s| s.to_string())
            .collect();

        entries.sort_by(|a, b| natord::compare_ignore_case(a, b));

        Ok(Self {
            archive_binary,
            entries,
            cache: Arc::new(Mutex::new(HashMap::new())),
            thread_pool: ThreadPool::new(container::NUM_OF_THREADS),
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
        })
    }
}

impl Drop for ZipContainer {
    fn drop(&mut self) {
        // Requests preloading cancel and waits for all threads to finish.
        if !self.is_preloading_cancel_requested.load(Ordering::Relaxed) {
            self.is_preloading_cancel_requested
                .store(true, Ordering::Relaxed);
        }
        self.thread_pool.join();
    }
}

fn load_image(entry: &String, archive_binary: Arc<Vec<u8>>) -> ContainerResult<Arc<Image>> {
    let mut buffer = Vec::new();
    let cursor = Cursor::new(&*archive_binary);
    let mut archive = ZipArchive::new(cursor)?;
    let mut file = archive.by_name(entry)?;
    file.read_to_end(&mut buffer)?;

    let image = Image::new(buffer)?;
    Ok(Arc::new(image))
}

fn preload(
    begin_index: usize,
    end: usize,
    entries: Vec<String>,
    archive_binary: Arc<Vec<u8>>,
    cache_mutex: Arc<Mutex<HashMap<String, Arc<Image>>>>,
    is_cancel_requested: Arc<AtomicBool>,
) -> ContainerResult<()> {
    for i in begin_index..end {
        if is_cancel_requested.load(Ordering::Relaxed) {
            return Ok(());
        }

        let entry = &entries[i];

        // If it's already in the cache, skip it.
        if cache_mutex
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .contains_key(entry)
        {
            log::debug!("Hit cache so skip preload index: {}", i);
            continue;
        }

        let image_arc = load_image(entry, archive_binary.clone())?;
        cache_mutex
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .insert(entry.clone(), image_arc);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{
        fs::File,
        io::Write,
        path::{self, Path},
        thread::sleep,
        time::Duration,
    };
    use tempfile::tempdir;
    use zip::write::{FileOptions, ZipWriter};

    use super::*;

    // Helper function to create a dummy ZIP file with specified image entries.
    fn create_dummy_zip(
        dir: &path::Path,
        filename: &str,
        entries: &[(&str, &[u8])],
    ) -> path::PathBuf {
        let zip_filepath = dir.join(filename);
        let file = File::create(&zip_filepath).expect("failed to create zip file");
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::<()>::default()
            .compression_method(zip::CompressionMethod::DEFLATE)
            .unix_permissions(0o755);

        for (entry_name, content) in entries {
            zip.start_file(entry_name, options)
                .expect("failed to start zip entry");
            zip.write_all(content)
                .expect("failed to write zip entry content");
        }
        zip.finish().expect("failed to finish zip file");
        zip_filepath
    }

    const DUMMY_PNG_DATA: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8,
        0xFF, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x53, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    #[test]
    fn test_new_valid_zip() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[
                ("image1.png", &DUMMY_PNG_DATA),
                ("image2.png", &DUMMY_PNG_DATA),
                ("text.txt", b"hello"),
            ],
        );

        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
            .expect("failed to create ZipContainer");

        assert_eq!(container.entries.len(), 2);
        assert_eq!(container.entries[0], "image1.png");
        assert_eq!(container.entries[1], "image2.png");
    }

    #[test]
    fn test_new_empty_zip() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(dir.path(), "empty.zip", &[]);

        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
            .expect("failed to create ZipContainer");
        assert!(container.entries.is_empty());
    }

    #[test]
    fn test_new_non_existent_zip() {
        let non_existent_path = String::from("/non/existent/file.zip");
        let container = ZipContainer::new(&non_existent_path);
        assert!(container.is_err());
    }

    #[test]
    fn test_get_entries() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(
            dir.path(),
            "test.zip",
            &[
                ("image_c.png", &DUMMY_PNG_DATA),
                ("image_a.png", &DUMMY_PNG_DATA),
                ("image_b.png", &DUMMY_PNG_DATA),
            ],
        );

        let container = ZipContainer::new(&zip_path.to_string_lossy().to_string()).unwrap();
        let entries = container.get_entries();

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], "image_a.png");
        assert_eq!(entries[1], "image_b.png");
        assert_eq!(entries[2], "image_c.png");
    }

    #[test]
    fn test_get_image_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let mut container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
            .expect("failed to create ZipContainer");

        let image = container
            .get_image(&String::from("image1.png"))
            .expect("get_image should succeed for existing image");
        assert_eq!(image.width, 1);
        assert_eq!(image.height, 1);
        assert_eq!(image.data, DUMMY_PNG_DATA);

        // Ensure caching works
        let image_from_cache = container
            .get_image_from_cache(&String::from("image1.png"))
            .expect("get_image_from_cache returned Err")
            .expect("image should be present in cache");
        assert_eq!(image.data, image_from_cache.data);
    }

    #[test]
    fn test_get_image_non_existing() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let mut container = ZipContainer::new(&zip_path.to_string_lossy().to_string()).unwrap();
        let result = container.get_image(&String::from("non_existent_image.png"));
        assert!(result.is_err());
    }

    #[test]
    fn test_request_preload() {
        let dir = tempdir().unwrap();
        let zip_path = create_dummy_zip(
            Path::new(dir.path()),
            "test.zip",
            &[
                ("image1.png", &DUMMY_PNG_DATA),
                ("image2.png", &DUMMY_PNG_DATA),
                ("image3.png", &DUMMY_PNG_DATA),
            ],
        );
        let mut container = ZipContainer::new(&zip_path.to_string_lossy().to_string()).unwrap();

        // Preload first two images
        container.request_preload(0, 2).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("image1.png")));
        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("image2.png")));
        assert!(!container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("image3.png")));

        // Ensure getting a preloaded image works
        let image_1 = container.get_image(&String::from("image1.png")).unwrap();
        assert_eq!(image_1.width, 1);

        // Preload the remaining image
        container.request_preload(2, 1).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .unwrap()
            .contains_key(&String::from("image3.png")));
    }

    #[test]
    fn test_request_preload_out_of_bounds() {
        let dir = tempdir().expect("failed to create tempdir");
        let zip_path = create_dummy_zip(dir.path(), "test.zip", &[("image1.png", &DUMMY_PNG_DATA)]);
        let mut container = ZipContainer::new(&zip_path.to_string_lossy().to_string())
            .expect("failed to create ZipContainer");

        // Attempt to preload beyond the number of entries
        container.request_preload(0, 5).unwrap();

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert!(container
            .cache
            .lock()
            .expect("failed to lock cache")
            .contains_key(&String::from("image1.png")));
        assert_eq!(
            container.cache.lock().expect("failed to lock cache").len(),
            1
        );

        container
            .request_preload(1, 1)
            .expect("request_preload failed"); // Should not add anything new

        // Wait for the threads to finish preloading.
        sleep(Duration::from_millis(1000));

        assert_eq!(
            container.cache.lock().expect("failed to lock cache").len(),
            1
        );
    }
}
