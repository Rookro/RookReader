//! The events the library commands broadcast to every window after a change.
//!
//! Each event names one list the frontend keeps, so a command reports only the lists it
//! changed and the frontend refetches only those.

/// A bookshelf was created or deleted.
pub(crate) const BOOKSHELVES_CHANGED_EVENT: &str = "bookshelves-changed";

/// A tag was created or deleted.
pub(crate) const TAGS_CHANGED_EVENT: &str = "tags-changed";

/// A series was created or deleted.
pub(crate) const SERIES_CHANGED_EVENT: &str = "series-changed";

/// A book was registered or deleted, or its bookshelves, tags, series or reading state
/// changed, so the book list of any bookshelf may differ.
pub(crate) const BOOKS_CHANGED_EVENT: &str = "books-changed";

/// The recently-read list changed: a book was opened or deleted, or history was cleared.
pub(crate) const READING_HISTORY_CHANGED_EVENT: &str = "reading-history-changed";

/// A page turn. Carries the updated `ReadingState` so the frontend patches the book in
/// place instead of refetching a list.
pub(crate) const READING_PROGRESS_CHANGED_EVENT: &str = "reading-progress-changed";

#[cfg(test)]
pub(crate) mod test_support {
    use std::sync::{Arc, Mutex};

    use tauri::Listener;

    use super::*;

    /// Records the name of every list event `app` emits from now on, in order.
    pub(crate) fn record_events<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
    ) -> Arc<Mutex<Vec<String>>> {
        let recorded = Arc::new(Mutex::new(Vec::new()));
        for name in [
            BOOKSHELVES_CHANGED_EVENT,
            TAGS_CHANGED_EVENT,
            SERIES_CHANGED_EVENT,
            BOOKS_CHANGED_EVENT,
            READING_HISTORY_CHANGED_EVENT,
        ] {
            let recorded = Arc::clone(&recorded);
            app.listen_any(name, move |_| {
                recorded.lock().unwrap().push(name.to_string())
            });
        }
        recorded
    }
}
