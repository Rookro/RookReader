use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use threadpool::ThreadPool;

use crate::container::{
    container::{Container, ContainerError, ContainerResult},
    image::Image,
};

/// Cache.(key: entry name, value: image)
type Cache = Arc<Mutex<HashMap<String, Arc<Image>>>>;

/// Image loader for a container.
pub struct ImageLoader {
    /// The image cache.
    cache: Cache,
    /// Thread pool for preloading.
    thread_pool: ThreadPool,
    /// Whether is preloading cancel requested.
    is_preloading_cancel_requested: Arc<AtomicBool>,
    /// The container.
    container: Arc<dyn Container>,
}

impl ImageLoader {
    /// Creates a new ImageLoader.
    ///
    /// * `container` - The container.
    pub fn new(container: Arc<dyn Container>) -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            thread_pool: ThreadPool::new(num_cpus::get()),
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
            container,
        }
    }

    /// Gets an image from the cache.
    ///
    /// Returns the image if the image is in the cache, otherwise returns None.
    ///
    /// * `entry` - The entry name.
    pub fn get_image_from_cache(&self, entry: &String) -> ContainerResult<Option<Arc<Image>>> {
        Ok(self
            .cache
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .get(entry)
            .map(|arc| Arc::clone(arc)))
    }

    /// Gets an image from the cache or loads it if not present.
    ///
    /// Returns the image.
    ///
    /// * `entry` - The entry name.
    pub fn get_image(&self, entry: &String) -> ContainerResult<Arc<Image>> {
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            log::debug!("Hit cache: {}", entry);
            return Ok(image_arc);
        }

        let image_arc = self.load_image(entry)?;
        self.cache
            .lock()
            .map_err(|e| ContainerError::Other(e.to_string()))?
            .insert(entry.clone(), image_arc.clone());

        Ok(image_arc)
    }

    /// Requests preloading of images.
    /// This function returns as soon as the request is made.
    ///
    /// * `begin_index` - The begin index of entries to preload.
    /// * `count` - The number of entries to preload.
    pub fn request_preload(&mut self, begin_index: usize, count: usize) -> ContainerResult<()> {
        let entries = self.container.get_entries();
        let total_pages = entries.len();
        let end = (begin_index + count).min(total_pages);

        if begin_index >= end {
            return Ok(());
        }

        self.cancel_preload();
        self.is_preloading_cancel_requested = Arc::new(AtomicBool::new(false));
        let is_cancel_requested = self.is_preloading_cancel_requested.clone();

        let entries_to_preload = entries[begin_index..end].to_vec();

        for entry in entries_to_preload {
            let is_cached = self
                .cache
                .lock()
                .map_err(|e| ContainerError::Other(e.to_string()))?
                .contains_key(&entry);
            if is_cached {
                continue;
            }

            let container = self.container.clone();
            let cache_clone = self.cache.clone();
            let is_cancel_requested = is_cancel_requested.clone();

            self.thread_pool.execute(move || {
                if is_cancel_requested.load(Ordering::Relaxed) {
                    return;
                }

                match container.get_image(&entry) {
                    Ok(image) => {
                        log::debug!("Preloaded: {}", entry);
                        match cache_clone.lock() {
                            Ok(mut cache) => {
                                cache.insert(entry, image);
                            }
                            Err(e) => {
                                log::error!("Failed to lock cache: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to preload image: {}", e);
                    }
                }
            });
        }

        Ok(())
    }

    /// Cancels all preloading tasks.
    pub fn cancel_preload(&self) {
        self.is_preloading_cancel_requested
            .store(true, Ordering::Relaxed);
    }

    /// Loads an image from the specified entry name.
    ///
    /// Returns the image.
    ///
    /// * `entry` - The entry name.
    fn load_image(&self, entry: &String) -> ContainerResult<Arc<Image>> {
        let image = self.container.get_image(entry)?;
        Ok(image)
    }
}

impl Drop for ImageLoader {
    fn drop(&mut self) {
        // Requests preloading cancel and waits for all threads to finish.
        self.cancel_preload();
        self.thread_pool.join();
    }
}
