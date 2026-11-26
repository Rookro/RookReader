//! The image cache shared by every open book.

use std::sync::Arc;

use crate::{
    image::types::Image,
    page::pipeline::{Fit, Rendered, Shape},
};

/// How many pages' shapes are remembered, about 17 MB at most: far more pages than the
/// default 1 GiB image cache holds, though a very large cache of small pages can hold
/// more. A page whose shape was evicted is a miss, never a wrong page.
const SHAPE_CAPACITY: u64 = 65_536;

/// One page of one book.
///
/// The book id is part of it because the cache outlives any one book: entry names
/// collide across archives — every book has an `0001.jpg` — so a key without it would
/// serve one book's page for another's.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct PageKey {
    book_id: String,
    entry: String,
}

impl PageKey {
    fn new(book_id: &str, entry: &str) -> Self {
        Self {
            book_id: book_id.to_string(),
            entry: entry.to_string(),
        }
    }
}

/// A page as it came out at one size.
///
/// Keyed by the size rather than the box it was fitted into: a tall page comes out the
/// same in any box of the same height, so a window that changes only its width is
/// served what it already has.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CacheKey {
    page: PageKey,
    size: (u32, u32),
}

/// The pages themselves, weighed by whoever builds the cache.
pub type Pages = mini_moka::sync::Cache<CacheKey, Arc<Image>>;

/// The pages every book has rendered, and the shape each was rendered from.
///
/// One value, so the two are always replaced and emptied together: pages kept past a
/// rendering change would be served, and a shape kept past one could pair with a page
/// read after it.
#[derive(Clone)]
pub struct Cache {
    pages: Pages,
    shapes: mini_moka::sync::Cache<PageKey, Shape>,
}

impl Cache {
    /// A cache of `pages`, with room for [`SHAPE_CAPACITY`] shapes beside them.
    pub fn new(pages: Pages) -> Self {
        Self {
            pages,
            shapes: mini_moka::sync::Cache::new(SHAPE_CAPACITY),
        }
    }

    /// The page as it comes out in `fit`, if it has come out at that size before.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The book's identifier.
    /// * `entry` - The entry name within the book.
    /// * `fit` - The box the caller would render the page into.
    ///
    /// # Returns
    ///
    /// `None` for a page never read, or a box no size can be predicted for.
    pub fn get(&self, book_id: &str, entry: &str, fit: Fit) -> Option<Arc<Image>> {
        let page = PageKey::new(book_id, entry);
        let size = self.shapes.get(&page)?.output_size(fit)?;
        self.pages.get(&CacheKey { page, size })
    }

    /// Stores a page under the size it came out at, then its shape, so a caller woken
    /// after this finds both.
    ///
    /// # Arguments
    ///
    /// * `book_id` - The book's identifier.
    /// * `entry` - The entry name within the book.
    /// * `rendered` - The page and its shape, from [`crate::page::pipeline::Pipeline::page`].
    pub fn put(&self, book_id: &str, entry: &str, rendered: &Rendered) {
        let page = PageKey::new(book_id, entry);
        let size = (rendered.image.width, rendered.image.height);
        self.pages.insert(
            CacheKey {
                page: page.clone(),
                size,
            },
            rendered.image.clone(),
        );
        // A pass-through never looks for frames, so it must not undo a page found fixed.
        // Two workers racing can still do so; that costs a read, never a wrong page.
        if matches!(rendered.shape, Shape::Scalable { .. })
            && matches!(self.shapes.get(&page), Some(Shape::Fixed { .. }))
        {
            return;
        }
        self.shapes.insert(page, rendered.shape);
    }

    /// Forgets every page and every shape.
    pub fn invalidate_all(&self) {
        self.pages.invalidate_all();
        self.shapes.invalidate_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::page::pipeline::{Fit, Rendered, Shape};

    fn rendered(width: u32, height: u32, shape: Shape) -> Rendered {
        Rendered {
            image: Arc::new(Image {
                data: vec![0],
                width,
                height,
            }),
            shape,
        }
    }

    fn cache() -> Cache {
        Cache::new(mini_moka::sync::Cache::new(100))
    }

    #[test]
    fn a_page_is_found_in_every_box_it_comes_out_the_same_size_in() {
        let cache = cache();
        // A 4x2 page shrunk into a box bound by its height.
        cache.put(
            "book",
            "p.png",
            &rendered(
                2,
                1,
                Shape::Scalable {
                    width: 4,
                    height: 2,
                },
            ),
        );
        assert!(cache
            .get(
                "book",
                "p.png",
                Fit {
                    width: 100,
                    height: 1
                }
            )
            .is_some());
        assert!(cache
            .get(
                "book",
                "p.png",
                Fit {
                    width: 50,
                    height: 1
                }
            )
            .is_some());
        assert!(
            cache
                .get(
                    "book",
                    "p.png",
                    Fit {
                        width: 100,
                        height: 2
                    }
                )
                .is_none(),
            "4x2 there"
        );
    }

    #[test]
    fn two_books_with_the_same_entry_do_not_share_pages() {
        let cache = cache();
        cache.put(
            "a",
            "p.png",
            &rendered(
                4,
                2,
                Shape::Scalable {
                    width: 4,
                    height: 2,
                },
            ),
        );
        assert!(cache.get("a", "p.png", Fit::UNBOUNDED).is_some());
        assert!(cache.get("b", "p.png", Fit::UNBOUNDED).is_none());
    }

    #[test]
    fn a_pass_through_does_not_undo_a_fixed_shape() {
        let cache = cache();
        let narrow = Fit {
            width: 2,
            height: 100,
        };
        // An animation: found fixed outside a box, then passed through inside one unchecked.
        cache.put(
            "book",
            "a.gif",
            &rendered(
                4,
                2,
                Shape::Fixed {
                    width: 4,
                    height: 2,
                },
            ),
        );
        cache.put(
            "book",
            "a.gif",
            &rendered(
                4,
                2,
                Shape::Scalable {
                    width: 4,
                    height: 2,
                },
            ),
        );
        assert!(cache.get("book", "a.gif", narrow).is_some());
    }

    #[test]
    fn emptying_the_cache_forgets_the_shapes_too() {
        let cache = cache();
        let narrow = Fit {
            width: 2,
            height: 100,
        };
        cache.put(
            "book",
            "a.gif",
            &rendered(
                4,
                2,
                Shape::Fixed {
                    width: 4,
                    height: 2,
                },
            ),
        );
        cache.invalidate_all();
        cache.put(
            "book",
            "a.gif",
            &rendered(
                4,
                2,
                Shape::Scalable {
                    width: 4,
                    height: 2,
                },
            ),
        );
        // A kept `Fixed` would predict 4x2 here and find the page just stored.
        assert!(cache.get("book", "a.gif", narrow).is_none());
    }
}
