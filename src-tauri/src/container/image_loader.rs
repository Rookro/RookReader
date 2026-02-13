use std::{
    cmp::min,
    io::Cursor,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use dashmap::DashMap;
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, ImageReader};
use log::debug;
use threadpool::ThreadPool;

use crate::{
    container::{container::Container, image::Image},
    error::Result,
};

/// Cache.(key: entry name, value: image)
type Cache = Arc<DashMap<String, Arc<Image>>>;

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
    /// The max image height.
    max_image_height: u32,
    /// The resize method.
    resize_method: FilterType,
}

impl ImageLoader {
    /// Creates a new ImageLoader.
    ///
    /// * `container` - The container.
    /// * `max_image_height` - The max image height.
    /// * `resize_method` - The resize method.
    pub fn new(
        container: Arc<dyn Container>,
        max_image_height: u32,
        resize_method: FilterType,
    ) -> Self {
        Self {
            cache: Arc::new(DashMap::with_capacity(container.get_entries().len())),
            // Use half of the available CPU cores for preloading.
            thread_pool: ThreadPool::new(min(1, num_cpus::get() / 2)),
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
            container,
            max_image_height,
            resize_method,
        }
    }

    /// Gets an image from the cache.
    ///
    /// Returns the image if the image is in the cache, otherwise returns None.
    ///
    /// * `entry` - The entry name.
    pub fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>> {
        if let Some(imag) = self.cache.get(entry) {
            Ok(Some(imag.clone()))
        } else {
            Ok(None)
        }
    }

    /// Gets an image from the cache or loads it if not present.
    ///
    /// Returns the image.
    ///
    /// * `entry` - The entry name.
    pub fn get_image(&self, entry: &String) -> Result<Arc<Image>> {
        if let Some(image_arc) = self.get_image_from_cache(entry)? {
            log::debug!("Hit cache: {}", entry);
            return Ok(image_arc);
        }

        let image_arc = load_image(
            entry,
            self.container.clone(),
            self.max_image_height,
            self.resize_method,
        )?;
        self.cache.insert(entry.clone(), image_arc.clone());

        Ok(image_arc)
    }

    /// Gets a preview image.
    /// This does not use or store to the cache.
    ///
    /// * `entry` - The entry name.
    pub fn get_preview_image(&self, entry: &String) -> Result<Arc<Image>> {
        let thumbnail = self.container.get_thumbnail(entry)?;
        Ok(thumbnail)
    }

    /// Requests preloading of images.
    /// This function returns as soon as the request is made.
    ///
    /// * `begin_index` - The begin index of entries to preload.
    /// * `count` - The number of entries to preload.
    pub fn request_preload(&mut self, begin_index: usize, count: usize) -> Result<()> {
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
            let is_cached = self.cache.contains_key(&entry);
            if is_cached {
                continue;
            }

            let container = self.container.clone();
            let cache_clone = self.cache.clone();
            let is_cancel_requested = is_cancel_requested.clone();
            let max_image_height = self.max_image_height.clone();
            let resize_method = self.resize_method.clone();

            self.thread_pool.execute(move || {
                if is_cancel_requested.load(Ordering::Relaxed) {
                    return;
                }

                match load_image(&entry, container, max_image_height, resize_method) {
                    Ok(image) => {
                        log::debug!("Preloaded: {}", entry);
                        cache_clone.insert(entry, image);
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
}

/// Loads an image from the specified entry name.
///
/// Returns the image.
///
/// * `entry` - The entry name.
/// * `container` - The container to load the image from.
/// * `max_image_height` - The maximum height of the image.
/// * `resize_method` - The resize method to use.
fn load_image(
    entry: &String,
    container: Arc<dyn Container>,
    max_image_height: u32,
    resize_method: FilterType,
) -> Result<Arc<Image>> {
    let image = container.get_image(entry)?;

    if max_image_height > 0 && image.height > max_image_height {
        debug!(
            "Resizing image: {}. (image height: {} -> {}, resize method: {:?})",
            entry, image.height, max_image_height, resize_method
        );
        let scaled_image = resize_image(image, max_image_height, resize_method)?;
        Ok(scaled_image)
    } else {
        Ok(image)
    }
}

/// Resizes an image to fit within the maximum height.
///
/// Returns the resized image.
///
/// * `image` - The image to resize.
/// * `height` - The height of the resized image.
/// * `resize_method` - The resize method to use.
fn resize_image(image: Arc<Image>, height: u32, resize_method: FilterType) -> Result<Arc<Image>> {
    let cursor = Cursor::new(&image.data);
    let image_reader = ImageReader::new(cursor).with_guessed_format()?;
    let image = image_reader.decode()?;

    let scaled_image = image.resize(u32::MAX, height, resize_method);

    let mut buffer = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 80);
    encoder.encode_image(&scaled_image)?;

    Ok(Arc::new(Image {
        data: buffer,
        width: scaled_image.width(),
        height: scaled_image.height(),
    }))
}

impl Drop for ImageLoader {
    fn drop(&mut self) {
        // Requests preloading cancel and waits for all threads to finish.
        self.cancel_preload();
        self.thread_pool.join();
    }
}
