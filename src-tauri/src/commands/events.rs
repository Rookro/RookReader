//! The events the backend broadcasts to the windows, and the frontend-only locale event.
//!
//! Each library event names one list the frontend keeps, so a command reports only the
//! lists it changed and the frontend refetches only those. Every event is registered in
//! `specta_builder()`, which generates its name and payload into the TypeScript bindings.
//!
//! Send them with [`emit`] or [`emit_to`]: the derived `Event::emit` panics on an app
//! whose events were never mounted, and this app never mounts them. Both log a failed send
//! rather than return it, because the change an event announces is already saved.

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Runtime};
use tauri_specta::Event;

use crate::{domain::book::entity::ReadingState, settings::AppSettings};

/// A collection was created or deleted.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct CollectionsChanged;

/// A tag was created or deleted.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct TagsChanged;

/// A series was created or deleted.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct SeriesChanged;

/// A book was registered or deleted, or its collections, tags, series or reading state
/// changed, so the book list of any collection may differ.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct BooksChanged;

/// The recently-read list changed: a book was opened or deleted, or history was cleared.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct ReadingHistoryChanged;

/// A page turn. Carries the updated `ReadingState` so the frontend patches the book in
/// place instead of refetching a list.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct ReadingProgressChanged(pub(crate) ReadingState);

/// The settings changed. Carries the full merged settings so other windows re-hydrate
/// from it without a fetch.
#[derive(Serialize, specta::Type, Event)]
pub(crate) struct SettingsChanged(pub(crate) AppSettings);

/// The application language changed. Only the frontend emits it: the language is kept
/// by i18next, not in `AppSettings`.
#[derive(Serialize, Deserialize, specta::Type, Event)]
pub(crate) struct LocaleChanged {
    /// The newly selected language tag (e.g. `"en-US"`, `"ja-JP"`).
    pub(crate) language: String,
}

/// Emits `event` to every window under its generated name.
///
/// The change an event announces is already saved, so a failed send is logged rather than
/// returned: the caller must not report a saved change as failed.
///
/// # Arguments
///
/// * `app` - The app (or any emitter) to emit through.
/// * `event` - The event to emit.
pub(crate) fn emit<R: Runtime, E: Event + Serialize>(app: &impl Emitter<R>, event: &E) {
    if let Err(e) = app.emit(E::NAME, event) {
        log::warn!("Failed to emit {}: {e}", E::NAME);
    }
}

/// Emits `event` under its generated name to the window labelled `target` only.
///
/// Like [`emit`], a failed send is logged rather than returned.
///
/// # Arguments
///
/// * `app` - The app (or any emitter) to emit through.
/// * `target` - The label of the window to deliver to.
/// * `event` - The event to emit.
pub(crate) fn emit_to<R: Runtime, E: Event + Serialize>(
    app: &impl Emitter<R>,
    target: &str,
    event: &E,
) {
    if let Err(e) = app.emit_to(target, E::NAME, event) {
        log::warn!("Failed to emit {} to window '{target}': {e}", E::NAME);
    }
}

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
            CollectionsChanged::NAME,
            TagsChanged::NAME,
            SeriesChanged::NAME,
            BooksChanged::NAME,
            ReadingHistoryChanged::NAME,
        ] {
            let recorded = Arc::clone(&recorded);
            app.listen_any(name, move |_| {
                recorded.lock().unwrap().push(name.to_string())
            });
        }
        recorded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// An event Tauri cannot serialize, so sending it always fails.
    #[derive(specta::Type, Event)]
    struct Unsendable;

    impl Serialize for Unsendable {
        fn serialize<S: serde::Serializer>(&self, _: S) -> Result<S::Ok, S::Error> {
            Err(serde::ser::Error::custom("cannot be sent"))
        }
    }

    #[test]
    fn a_failed_send_is_logged_not_returned() {
        let app = tauri::test::mock_app();
        assert!(
            app.handle().emit(Unsendable::NAME, &Unsendable).is_err(),
            "the fixture must fail to send"
        );

        // The change an event announces is already saved; the caller must not be told it failed.
        let () = emit(app.handle(), &Unsendable);
        let () = emit_to(app.handle(), "main", &Unsendable);
    }

    #[test]
    fn event_names_are_pinned() {
        assert_eq!(CollectionsChanged::NAME, "collections-changed");
        assert_eq!(TagsChanged::NAME, "tags-changed");
        assert_eq!(SeriesChanged::NAME, "series-changed");
        assert_eq!(BooksChanged::NAME, "books-changed");
        assert_eq!(ReadingHistoryChanged::NAME, "reading-history-changed");
        assert_eq!(ReadingProgressChanged::NAME, "reading-progress-changed");
        assert_eq!(SettingsChanged::NAME, "settings-changed");
        assert_eq!(LocaleChanged::NAME, "locale-changed");
    }

    #[test]
    fn event_payloads_serialize_as_before() {
        for unit in [
            serde_json::to_value(&CollectionsChanged),
            serde_json::to_value(&TagsChanged),
            serde_json::to_value(&SeriesChanged),
            serde_json::to_value(&BooksChanged),
            serde_json::to_value(&ReadingHistoryChanged),
        ] {
            assert_eq!(unit.unwrap(), serde_json::Value::Null);
        }

        let state = ReadingState {
            book_id: 7,
            last_read_page_index: 3,
            cfi: Some("epubcfi(/6/2)".to_string()),
            last_opened_at: None,
        };
        assert_eq!(
            serde_json::to_value(ReadingProgressChanged(state.clone())).unwrap(),
            serde_json::to_value(&state).unwrap(),
        );

        let settings = AppSettings::default();
        assert_eq!(
            serde_json::to_value(SettingsChanged(settings.clone())).unwrap(),
            serde_json::to_value(&settings).unwrap(),
        );

        assert_eq!(
            serde_json::to_value(LocaleChanged {
                language: "ja-JP".to_string()
            })
            .unwrap(),
            serde_json::json!({ "language": "ja-JP" }),
        );
    }
}
