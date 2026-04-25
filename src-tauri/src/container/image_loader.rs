use std::{
    cmp::max,
    io::Cursor,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use dashmap::DashMap;
use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, ImageReader};
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use rayon::ThreadPool;

use crate::{
    container::{image::Image, traits::Container},
    error::Result,
};

/// A thread-safe cache mapping entry names to `Image` data.
type Cache = Arc<DashMap<String, Arc<Image>>>;

/// Manages loading, caching, and preloading of images from a `Container`.
///
/// This struct handles concurrent image loading in the background, provides a thread-safe
/// cache, and manages the lifecycle of the preloading Rayon thread pool.
pub struct ImageLoader {
    /// A shared, thread-safe cache for storing loaded images.
    cache: Cache,
    /// A Rayon thread pool dedicated to preloading images in the background.
    thread_pool: ThreadPool,
    /// An atomic flag used to signal cancellation to active preloading threads.
    is_preloading_cancel_requested: Arc<AtomicBool>,
    /// A shared reference to the container from which images are loaded.
    container: Arc<dyn Container>,
    /// The maximum height to which images should be resized upon loading. 0 means no limit.
    max_image_height: u32,
    /// The filter type to use when resizing images.
    resize_method: FilterType,
}

impl ImageLoader {
    /// Creates a new `ImageLoader` for a given container.
    ///
    /// It initializes a Rayon thread pool for preloading, using half of the available CPU cores.
    ///
    /// # Arguments
    ///
    /// * `container` - A shared reference to a `Container` implementation.
    /// * `max_image_height` - The maximum height for loaded images.
    /// * `resize_method` - The algorithm to use for image resizing.
    ///
    /// # Returns
    ///
    /// A new instance of `ImageLoader`.
    pub fn new(
        container: Arc<dyn Container>,
        max_image_height: u32,
        resize_method: FilterType,
    ) -> Self {
        let default_parallelism =
            std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
        let num_threads = max(1, default_parallelism / 2);
        let thread_pool = rayon::ThreadPoolBuilder::new()
            .num_threads(num_threads)
            .thread_name(|i| format!("image-loader-{}", i))
            .build()
            .unwrap();

        Self {
            cache: Arc::new(DashMap::with_capacity(container.get_entries().len())),
            thread_pool,
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
            container,
            max_image_height,
            resize_method,
        }
    }

    /// Retrieves an image directly from the cache.
    ///
    /// # Arguments
    ///
    /// * `entry` - The name of the image entry to look up in the cache.
    ///
    /// # Returns
    ///
    /// An `Ok(Some(Arc<Image>))` if the image is found in the cache, `Ok(None)` otherwise.
    pub fn get_image_from_cache(&self, entry: &str) -> Result<Option<Arc<Image>>> {
        if let Some(imag) = self.cache.get(entry) {
            Ok(Some(imag.clone()))
        } else {
            Ok(None)
        }
    }

    /// Retrieves an image, loading it from the container if not found in the cache.
    ///
    /// If the image is not in the cache, it is loaded, resized if necessary,
    /// inserted into the cache, and then returned.
    ///
    /// # Arguments
    ///
    /// * `entry` - The name of the image entry to retrieve.
    ///
    /// # Returns
    ///
    /// A `Result` containing a shared pointer to the `Image`.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the image cannot be loaded or resized.
    pub fn get_image(&self, entry: &str) -> Result<Arc<Image>> {
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
        self.cache.insert(entry.to_string(), image_arc.clone());

        Ok(image_arc)
    }

    /// Retrieves a preview (thumbnail) for a given image entry.
    ///
    /// This method is optimized to skip thumbnail generation if the full-sized image
    /// is already present in the cache.
    ///
    /// # Arguments
    ///
    /// * `entry` - The name of the image entry for which to get a preview.
    ///
    /// # Returns
    ///
    /// An `Ok(Some(Arc<Image>))` containing the thumbnail if generated.
    /// An `Ok(None)` if the full image was already cached, skipping thumbnail generation.
    ///
    /// # Errors
    ///
    /// Returns an `Err` if the thumbnail cannot be generated.
    pub fn get_preview_image(&self, entry: &str) -> Result<Option<Arc<Image>>> {
        if self.get_image_from_cache(entry)?.is_some() {
            log::debug!("Skip create the thumbnail. Hit cache: {}", entry);
            return Ok(None);
        }

        let thumbnail = self.container.get_thumbnail(entry)?;
        Ok(Some(thumbnail))
    }

    /// Submits a request to preload a range of images in the background using Rayon.
    ///
    /// This function cancels any ongoing preloading tasks and starts a new one for the
    /// specified range. It returns immediately, and the preloading occurs on a
    /// background Rayon thread pool.
    ///
    /// # Arguments
    ///
    /// * `begin_index` - The starting index in the container's entry list to preload from.
    /// * `count` - The number of images to preload from the `begin_index`.
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

        let entries_to_preload: Vec<String> = entries[begin_index..end]
            .iter()
            .filter(|&entry| !self.cache.contains_key(entry))
            .cloned()
            .collect();

        if entries_to_preload.is_empty() {
            return Ok(());
        }

        let container = self.container.clone();
        let cache_clone = self.cache.clone();
        let max_image_height = self.max_image_height;
        let resize_method = self.resize_method;

        // Execute preloading in the Rayon thread pool.
        // Tasks are distributed across threads using Rayon's work-stealing scheduler.
        self.thread_pool.spawn(move || {
            entries_to_preload.into_par_iter().for_each(|entry| {
                if is_cancel_requested.load(Ordering::Relaxed) {
                    return;
                }

                match load_image(&entry, container.clone(), max_image_height, resize_method) {
                    Ok(image) => {
                        log::debug!("Preloaded: {}", entry);
                        cache_clone.insert(entry, image);
                    }
                    Err(e) => {
                        log::error!("Failed to preload image: {}", e);
                    }
                }
            });
        });

        Ok(())
    }

    /// Signals all active preloading threads to cancel their work.
    ///
    /// This sets an atomic flag that the background threads check periodically.
    /// The cancellation is not instantaneous.
    pub fn cancel_preload(&self) {
        self.is_preloading_cancel_requested
            .store(true, Ordering::Relaxed);
    }
}

impl Drop for ImageLoader {
    fn drop(&mut self) {
        self.cancel_preload();
    }
}

/// Helper function to load an image from a container and resize it if necessary.
fn load_image(
    entry: &str,
    container: Arc<dyn Container>,
    max_image_height: u32,
    resize_method: FilterType,
) -> Result<Arc<Image>> {
    let image = container.get_image(entry)?;

    if max_image_height > 0 && image.height > max_image_height {
        let scaled_image = resize_image(image, max_image_height, resize_method)?;
        Ok(scaled_image)
    } else {
        Ok(image)
    }
}

/// Helper function to resize an image and re-encode it as a JPEG.
///
/// # Arguments
///
/// * `image` - A shared pointer to the original `Image`.
/// * `height` - The target height for the resized image.
/// * `resize_method` - The algorithm to use for resizing.
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
