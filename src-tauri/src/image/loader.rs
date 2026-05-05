use std::{
    cmp::max,
    io::Cursor,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use dashmap::DashMap;
use image::{codecs::jpeg::JpegEncoder, ImageReader};
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use rayon::ThreadPool;

use crate::{
    container::traits::Container,
    error::Result,
    image::{
        resizer::{shrink_to_fit, ResizeFilter},
        types::Image,
    },
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
    resize_method: ResizeFilter,
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
        resize_method: ResizeFilter,
    ) -> Result<Self> {
        let num_threads = if container.is_single_threaded() {
            1
        } else {
            let default_parallelism =
                std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);
            max(1, default_parallelism / 2)
        };

        let thread_pool = rayon::ThreadPoolBuilder::new()
            .num_threads(num_threads)
            .thread_name(|i| format!("image-loader-{}", i))
            .build()?;

        Ok(Self {
            cache: Arc::new(DashMap::with_capacity(container.get_entries().len())),
            thread_pool,
            is_preloading_cancel_requested: Arc::new(AtomicBool::new(false)),
            container,
            max_image_height,
            resize_method,
        })
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

    /// Submits a request to preload images around a specific index.
    ///
    /// It prioritizes pages closer to the `center_index` and those in the likely
    /// reading direction (forward).
    ///
    /// # Arguments
    ///
    /// * `center_index` - The current page index around which to preload.
    /// * `buffer_size` - How many pages to preload in each direction.
    pub fn request_preload_around(
        &mut self,
        center_index: usize,
        buffer_size: usize,
    ) -> Result<()> {
        let entries = self.container.get_entries();
        let total_pages = entries.len();

        if total_pages == 0 {
            return Ok(());
        }

        let start = center_index.saturating_sub(buffer_size);
        let end = (center_index + buffer_size + 1).min(total_pages);

        self.cancel_preload();
        self.is_preloading_cancel_requested = Arc::new(AtomicBool::new(false));
        let is_cancel_requested = self.is_preloading_cancel_requested.clone();

        // Generate target indices and sort them by priority:
        // 1. Distance from center (closer = higher priority)
        // 2. Future pages get slight preference over past pages
        let mut target_indices: Vec<usize> = (start..end)
            .filter(|&i| !self.cache.contains_key(&entries[i]))
            .collect();

        target_indices.sort_by_key(|&i| {
            let dist = (i as isize - center_index as isize).abs();
            // Give slight preference to future pages by making their "sort distance" smaller
            if i >= center_index {
                dist * 2
            } else {
                dist * 2 + 1
            }
        });

        if target_indices.is_empty() {
            return Ok(());
        }

        let entries_to_preload: Vec<String> = target_indices
            .into_iter()
            .map(|i| entries[i].clone())
            .collect();

        let container = self.container.clone();
        let cache_clone = self.cache.clone();
        let max_image_height = self.max_image_height;
        let resize_method = self.resize_method;

        // Execute preloading in the Rayon thread pool.
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
        // Requests preloading cancel when the ImageLoader is dropped.
        // Rayon's ThreadPool will naturally wait for its threads to finish upon being dropped,
        // but signaling cancellation helps them stop sooner.
        self.cancel_preload();
    }
}

/// Helper function to load an image from a container and resize it if necessary.
///
/// # Arguments
///
/// * `entry` - The name of the image entry to load.
/// * `container` - A shared reference to the container.
/// * `max_image_height` - The maximum height for the image.
/// * `resize_method` - The algorithm to use for resizing.
fn load_image(
    entry: &str,
    container: Arc<dyn Container>,
    max_image_height: u32,
    resize_method: ResizeFilter,
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
fn resize_image(image: Arc<Image>, height: u32, resize_method: ResizeFilter) -> Result<Arc<Image>> {
    let cursor = Cursor::new(&image.data);
    let image_reader = ImageReader::new(cursor).with_guessed_format()?;
    let dyn_image = image_reader.decode()?;

    // Use SIMD accelerated resizing
    // max_width is u32::MAX to scale based entirely on height
    let scaled_image = shrink_to_fit(&dyn_image, u32::MAX, height, resize_method)?;

    let mut buffer = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, 80);
    encoder.encode_image(&scaled_image)?;

    Ok(Arc::new(Image {
        data: buffer,
        width: scaled_image.width(),
        height: scaled_image.height(),
    }))
}
