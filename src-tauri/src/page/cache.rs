//! The image cache shared by every open book.

use std::sync::Arc;

use crate::image::types::Image;

/// The composite key for the global image cache.
///
/// The book id is part of the key because the cache outlives any one book: entry names
/// collide across archives — every book has an `0001.jpg` — so a key without it would
/// serve one book's page for another's.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CacheKey {
    /// The unique identifier of the book.
    pub book_id: String,
    /// The name of the image entry within the book.
    pub entry: String,
}

/// A thread-safe cache mapping entry names to `Image` data.
pub type Cache = mini_moka::sync::Cache<CacheKey, Arc<Image>>;
