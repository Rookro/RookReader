use std::sync::Arc;
use tokio::sync::RwLock;

use serde::Serialize;
use tauri::State;

use crate::commands::events::{emit, BooksChanged, ReadingHistoryChanged, ReadingProgressChanged};
use crate::container::describe::describe;
use crate::container::traits::Container;
use crate::domain::book::entity::{Book, BookWithState, Direction, ReadBook, ReadingState};
use crate::domain::book::repository::BookRepository;
use crate::error::{Error, Result};
use crate::infrastructure::thumbnails;
use crate::settings::{AppSettings, CurrentSettings};
use crate::state::app_state::AppState;
use crate::state::container_state::ContainerState;

/// Retrieves a book by its unique ID.
///
/// # Arguments
///
/// * `id` - The unique identifier of the book.
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` which is `Ok` containing an `Option<Book>`.
/// It evaluates to `Some(Book)` if a matching book is found, or `None` if no such book exists.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_book(id: i64, repo: State<'_, Arc<dyn BookRepository>>) -> Result<Option<Book>> {
    log::debug!("Get book by id({}).", id);
    repo.get_by_id(id).await
}

/// Retrieves a book by its unique file path.
///
/// # Arguments
///
/// * `file_path` - The unique file or directory path.
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` which is `Ok` containing an `Option<Book>`.
/// It evaluates to `Some(Book)` if a matching book is found, or `None` if no such book exists.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_book_by_path(
    file_path: String,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Option<Book>> {
    log::debug!("Get book by path({}).", file_path);
    repo.get_by_path(&file_path).await
}

/// Registers a book or returns its ID if it already exists, without updating reading state.
///
/// The book's item type, display name, and page count are read from its container.
///
/// # Arguments
///
/// * `file_path` - The unique file or directory path.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
/// * `state` - The managed app state.
///
/// # Returns
///
/// A `Result` containing the ID of the registered book.
///
/// # Errors
///
/// Returns an `Err` if the container cannot be opened, `EmptyContainer` when it holds no
/// readable pages, or an `Err` if the repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn register_book<R: tauri::Runtime>(
    file_path: String,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
    state: State<'_, RwLock<AppState>>,
) -> Result<i64> {
    log::debug!("Register the book: {}", file_path);

    let container = ContainerState::container_for(&state, &file_path).await?;
    let description = describe(&file_path, container.as_ref())?;
    let thumbnail_path = thumbnails::cover_for(&app, &file_path, container).await;

    let book_id = repo
        .register(
            &file_path,
            description.item_type,
            &description.display_name,
            description.total_pages,
            thumbnail_path,
        )
        .await?;

    emit(&app, &BooksChanged);

    Ok(book_id)
}

/// What `open_book` returns: the open book's pages and its library record.
#[derive(Serialize, specta::Type)]
pub struct OpenedBook {
    /// The entry names in the book.
    pub entries: Vec<String>,
    /// Whether the book is a directory.
    pub is_directory: bool,
    /// Whether the book is an EPUB novel.
    pub is_novel: bool,
    /// Whether `get_image_preview` can send a page more cheaply than `get_image`.
    pub has_previews: bool,
    /// The book's library record, or `None` when it could not be recorded.
    pub book: Option<BookWithState>,
    /// Why the book could not be recorded, when it could not.
    pub record_error: Option<Error>,
}

/// Opens a book as the open book and records it in the library, and in the reading history
/// while that is on.
///
/// Its page service replaces the previous book's without reading a page. A comic without a
/// stored direction gets the reader's default one.
///
/// # Arguments
///
/// * `path` - The file or directory path of the book.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
/// * `state` - The managed app state.
/// * `settings` - The current settings the history setting and default direction are read from.
///
/// # Returns
///
/// The book's entries and its library record. When the book opens but cannot be recorded,
/// `book` is `None` and `record_error` says why.
///
/// # Errors
///
/// Returns an `Err` if the container cannot be opened, or `EmptyContainer` when it holds no
/// readable pages. A failure to record the book is returned in `record_error`, not as an
/// `Err`.
#[tauri::command]
#[specta::specta]
pub async fn open_book<R: tauri::Runtime>(
    path: String,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
    state: State<'_, RwLock<AppState>>,
    settings: State<'_, CurrentSettings>,
) -> Result<OpenedBook> {
    log::debug!("Open book: {path}");

    let container = ContainerState::open(&state, &path).await?;
    let settings = settings.read().await.clone();
    let recorded = record_opened_book(
        &path,
        container.clone(),
        repo.inner().as_ref(),
        &app,
        &settings,
    )
    .await;
    // The pages are open either way; failing to remember the book is reported apart.
    let (book, record_error) = match recorded {
        Ok(book) => (Some(book), None),
        Err(e) => {
            log::error!("Could not record the opened book {path}: {e}");
            (None, Some(e))
        }
    };

    Ok(OpenedBook {
        entries: container.get_entries().clone(),
        is_directory: container.is_directory(),
        is_novel: container.is_novel(),
        has_previews: container.has_previews(),
        book,
        record_error,
    })
}

/// Records the book at `file_path` in the library and, while reading history is on, in
/// the history.
async fn record_opened_book<R: tauri::Runtime>(
    file_path: &str,
    container: Arc<dyn Container>,
    repo: &dyn BookRepository,
    app: &tauri::AppHandle<R>,
    settings: &AppSettings,
) -> Result<BookWithState> {
    let description = describe(file_path, container.as_ref())?;
    let thumbnail_path = thumbnails::cover_for(app, file_path, container).await;
    let records_history = settings.history.record_reading_history;

    let book_id = if records_history {
        repo.record_opened(
            file_path,
            description.item_type,
            &description.display_name,
            description.total_pages,
            thumbnail_path,
        )
        .await?
    } else {
        repo.register(
            file_path,
            description.item_type,
            &description.display_name,
            description.total_pages,
            thumbnail_path,
        )
        .await?
    };
    let mut book = repo
        .get_book_with_state_by_id(book_id)
        .await?
        .ok_or_else(|| Error::Other(format!("Book {book_id} vanished after it was recorded")))?;

    // A novel's direction is the EPUB's own and cannot be overridden.
    if !description.is_novel && book.reading_direction.is_none() {
        let direction = settings.reader.comic.reading_direction;
        if let Err(e) = repo.update_reading_direction(book_id, direction).await {
            log::warn!("Could not store the reading direction of book {book_id}: {e}");
        }
        book.reading_direction = Some(direction);
    }

    emit(app, &BooksChanged);
    if records_history {
        emit(app, &ReadingHistoryChanged);
    }
    Ok(book)
}

/// Clears the reading history for a specific book.
///
/// # Arguments
///
/// * `book_id` - The unique identifier of the book.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn clear_reading_history<R: tauri::Runtime>(
    book_id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Clear reading history of {:?}", book_id);
    repo.clear_reading_history(book_id).await?;
    emit(&app, &BooksChanged);
    emit(&app, &ReadingHistoryChanged);
    Ok(())
}

/// Clears the reading history for all books in the library.
///
/// # Arguments
///
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn clear_all_reading_history<R: tauri::Runtime>(
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Clear all reading history");
    repo.clear_all_reading_history().await?;
    emit(&app, &BooksChanged);
    emit(&app, &ReadingHistoryChanged);
    Ok(())
}

/// Updates the reading progress/state for a book.
///
/// # Arguments
///
/// * `state_data` - The `ReadingState` object sent from the frontend.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn update_reading_progress<R: tauri::Runtime>(
    state_data: ReadingState,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Update reading progress: {:?}", state_data);
    repo.update_reading_progress(&state_data).await?;
    emit(&app, &ReadingProgressChanged(state_data));
    Ok(())
}

/// Records the reader's correction to how a book pairs into spreads.
///
/// Written straight through rather than debounced with the reading progress: this changes
/// on a button press, not on every page turn, and it must be kept even when the reader has
/// turned reading history off.
///
/// # Arguments
///
/// * `book_id` - The book to update.
/// * `is_spread_shifted` - Whether the reader has shifted the book's spreads.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// Returns an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn update_spread_shift(
    book_id: i64,
    is_spread_shifted: bool,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<()> {
    log::debug!("Update spread shift of book {book_id}: {is_spread_shifted}");
    repo.update_spread_shift(book_id, is_spread_shifted).await?;
    Ok(())
}

/// Records the page direction a book opens with.
///
/// Written straight through rather than debounced with the reading progress: it changes on
/// a button press, not on every page turn, and it must be kept even when the reader has
/// turned reading history off.
///
/// # Arguments
///
/// * `book_id` - The book to update.
/// * `reading_direction` - The direction the book's pages are turned in.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// Returns an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn update_reading_direction(
    book_id: i64,
    reading_direction: Direction,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<()> {
    log::debug!("Update reading direction of book {book_id}: {reading_direction:?}");
    repo.update_reading_direction(book_id, reading_direction)
        .await?;
    Ok(())
}

/// Records how a book's pages are shaped, so it need not be measured again.
///
/// # Arguments
///
/// * `book_id` - The book to update.
/// * `landscape_bits` - One `'0'`/`'1'` per page in entry order, `'1'` for a page wider
///   than it is tall.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// Returns an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn update_page_layout(
    book_id: i64,
    landscape_bits: String,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<()> {
    log::debug!(
        "Update page layout of book {book_id}: {} pages",
        landscape_bits.len()
    );
    repo.update_page_layout(book_id, &landscape_bits).await?;
    Ok(())
}

/// Retrieves recently read books, ordered by the most recently opened.
///
/// # Arguments
///
/// * `limit` - The maximum number of books to retrieve.
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `ReadBook` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_recently_read_books(
    limit: Option<i64>,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<ReadBook>> {
    log::debug!("Get recently read books(limit: {:?}).", limit);
    repo.get_recently_read_books(limit).await
}

/// Retrieves all books, including their reading states.
///
/// # Arguments
///
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `BookWithState` entities, or an error message string..
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_all_books_with_state(
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get all books with state.");
    repo.get_all_books_with_state().await
}

/// Deletes a book by its unique ID, along with its thumbnail file.
///
/// # Arguments
///
/// * `id` - The unique identifier of the book to delete.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn delete_book<R: tauri::Runtime>(
    id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Delete book by id({}).", id);
    let thumbnail_path = repo
        .get_by_id(id)
        .await?
        .and_then(|book| book.thumbnail_path);
    repo.delete(id).await?;
    if let Some(path) = thumbnail_path {
        thumbnails::remove(path).await;
    }
    emit(&app, &BooksChanged);
    emit(&app, &ReadingHistoryChanged);
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::commands::events::test_support::record_events;
    use crate::domain::book::entity::ItemType;
    use crate::domain::book::repository::MockBookRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;
    use tauri_specta::Event;

    #[tokio::test]
    async fn test_get_book() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|id| {
                Ok(Some(Book {
                    id,
                    file_path: "path".to_string(),
                    item_type: ItemType::File,
                    display_name: "name".to_string(),
                    total_pages: 10,
                    series_id: None,
                    series_order: None,
                    thumbnail_path: None,
                }))
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = get_book(1, state).await;
        assert!(result.is_ok());
        let book = result.unwrap();
        assert!(book.is_some());
        {
            let book = book.unwrap();
            assert_eq!(book.id, 1);
            assert_eq!(book.file_path, "path");
            assert_eq!(book.item_type, ItemType::File);
            assert_eq!(book.display_name, "name");
            assert_eq!(book.total_pages, 10);
            assert!(book.series_id.is_none());
            assert!(book.series_order.is_none());
            assert!(book.thumbnail_path.is_none());
        }
    }

    #[tokio::test]
    async fn test_get_book_by_path() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_path()
            .with(mockall::predicate::eq("fake_path"))
            .times(1)
            .returning(|path| {
                Ok(Some(Book {
                    id: 1,
                    file_path: path.to_string(),
                    item_type: ItemType::File,
                    display_name: "name".to_string(),
                    total_pages: 10,
                    series_id: None,
                    series_order: None,
                    thumbnail_path: None,
                }))
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = get_book_by_path("fake_path".to_string(), state).await;
        assert!(result.is_ok());
        let book = result.unwrap();
        assert!(book.is_some());
        {
            let book = book.unwrap();
            assert_eq!(book.id, 1);
            assert_eq!(book.file_path, "fake_path");
            assert_eq!(book.item_type, ItemType::File);
            assert_eq!(book.display_name, "name");
            assert_eq!(book.total_pages, 10);
            assert!(book.series_id.is_none());
            assert!(book.series_order.is_none());
            assert!(book.thumbnail_path.is_none());
        }
    }

    #[tokio::test]
    async fn test_delete_book() {
        let dir = tempfile::tempdir().unwrap();
        let thumbnail = dir.path().join("thumbnail_1.jpg");
        std::fs::write(&thumbnail, b"jpg").unwrap();
        let thumbnail_path = thumbnail.to_string_lossy().to_string();

        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(move |id| {
                Ok(Some(Book {
                    id,
                    file_path: "path".to_string(),
                    item_type: ItemType::File,
                    display_name: "name".to_string(),
                    total_pages: 10,
                    series_id: None,
                    series_order: None,
                    thumbnail_path: Some(thumbnail_path.clone()),
                }))
            });
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();
        let events = record_events(app.handle());

        let result = delete_book(1, repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(
            *events.lock().unwrap(),
            [BooksChanged::NAME, ReadingHistoryChanged::NAME]
        );
        assert!(!thumbnail.exists(), "the thumbnail must go with the book");
    }

    #[tokio::test]
    async fn test_delete_book_without_thumbnail() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|id| {
                Ok(Some(Book {
                    id,
                    file_path: "path".to_string(),
                    item_type: ItemType::File,
                    display_name: "name".to_string(),
                    total_pages: 10,
                    series_id: None,
                    series_order: None,
                    thumbnail_path: None,
                }))
            });
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();

        let result = delete_book(1, repo, app.handle().clone()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_clear_reading_history() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_clear_reading_history()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();
        let events = record_events(app.handle());

        let result = clear_reading_history(1, repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(
            *events.lock().unwrap(),
            [BooksChanged::NAME, ReadingHistoryChanged::NAME]
        );
    }

    #[tokio::test]
    async fn test_update_reading_progress() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_update_reading_progress()
            .withf(|state: &ReadingState| {
                state.book_id == 1
                    && state.last_read_page_index == 7
                    && state.cfi.as_deref() == Some("epubcfi(/6/8!/4/2/1:0)")
            })
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();

        let state_data = ReadingState {
            book_id: 1,
            last_read_page_index: 7,
            cfi: Some("epubcfi(/6/8!/4/2/1:0)".to_string()),
            last_opened_at: None,
        };
        let result = update_reading_progress(state_data, repo, app.handle().clone()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_update_reading_direction() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_update_reading_direction()
            .with(
                mockall::predicate::eq(7),
                mockall::predicate::eq(Direction::Ltr),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();

        let result = update_reading_direction(7, Direction::Ltr, repo).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_clear_all_reading_history() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_clear_all_reading_history()
            .times(1)
            .returning(|| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();
        let events = record_events(app.handle());

        let result = clear_all_reading_history(repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(
            *events.lock().unwrap(),
            [BooksChanged::NAME, ReadingHistoryChanged::NAME]
        );
    }

    #[tokio::test]
    async fn test_get_recently_read_books() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_recently_read_books()
            .with(mockall::predicate::eq(Some(5)))
            .times(1)
            .returning(|_| Ok(vec![]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = get_recently_read_books(Some(5), state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_all_books_with_state() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_all_books_with_state()
            .times(1)
            .returning(|| Ok(vec![]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = get_all_books_with_state(state).await;
        assert!(result.is_ok());
    }

    /// A 4x4 PNG page.
    fn png_page() -> Vec<u8> {
        let mut page = Vec::new();
        image::DynamicImage::ImageRgb8(image::RgbImage::new(4, 4))
            .write_to(
                &mut std::io::Cursor::new(&mut page),
                image::ImageFormat::Png,
            )
            .unwrap();
        page
    }

    /// The folder `dir/name` holding `pages` PNG pages.
    fn png_folder(dir: &std::path::Path, name: &str, pages: usize) -> String {
        let folder = dir.join(name);
        fs::create_dir(&folder).unwrap();
        for i in 1..=pages {
            fs::write(folder.join(format!("p{i}.png")), png_page()).unwrap();
        }
        folder.to_string_lossy().into_owned()
    }

    /// Removes, on drop, the thumbnail a command under test saves for `file_path`: the
    /// mock app's data folder is the real one, not a temporary directory.
    struct ThumbnailCleanup(std::path::PathBuf);

    impl ThumbnailCleanup {
        fn new(app: &tauri::App<tauri::test::MockRuntime>, file_path: &str) -> Self {
            Self(
                crate::paths::app_data_dir(app)
                    .unwrap()
                    .join("thumbnails")
                    .join(thumbnails::file_name(file_path)),
            )
        }
    }

    impl Drop for ThumbnailCleanup {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }

    #[tokio::test]
    async fn register_book_describes_the_book_itself() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "My Book", 2);

        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_register()
            .with(
                mockall::predicate::eq(path.clone()),
                mockall::predicate::eq(ItemType::Directory),
                mockall::predicate::eq("My Book"),
                mockall::predicate::eq(2),
                mockall::predicate::always(),
            )
            .times(1)
            .returning(|_, _, _, _, _| Ok(1));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));
        let events = record_events(app.handle());

        let result = register_book(path, app.state(), app.handle().clone(), app.state()).await;

        assert_eq!(result.unwrap(), 1);
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn register_book_refuses_a_container_without_pages() {
        use std::io::Write;
        use zip::write::{FileOptions, ZipWriter};

        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("multi.zip");
        let mut zip = ZipWriter::new(fs::File::create(&zip_path).unwrap());
        for name in ["Vol1/p1.png", "Vol2/p1.png"] {
            zip.start_file(name, FileOptions::<()>::default()).unwrap();
            zip.write_all(&png_page()).unwrap();
        }
        zip.finish().unwrap();

        let mut mock_repo = MockBookRepository::new();
        mock_repo.expect_register().times(0);

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));
        let events = record_events(app.handle());

        let result = register_book(
            zip_path.to_string_lossy().into_owned(),
            app.state(),
            app.handle().clone(),
            app.state(),
        )
        .await;

        assert!(matches!(result, Err(Error::EmptyContainer(_))));
        assert!(events.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn registering_a_book_leaves_the_open_book_alone() {
        // Opening installs what it opens, which closes the reader threads of whatever was
        // open before; registering must not.
        let dir = tempfile::tempdir().unwrap();
        let open = png_folder(dir.path(), "Open", 1);
        let other = png_folder(dir.path(), "Other", 1);

        let mut mock_repo = MockBookRepository::new();
        mock_repo.expect_register().returning(|_, _, _, _, _| Ok(2));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &other);
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));
        ContainerState::open(&app.state::<RwLock<AppState>>(), &open)
            .await
            .unwrap();

        register_book(other, app.state(), app.handle().clone(), app.state())
            .await
            .unwrap();

        let binding = app.state::<RwLock<AppState>>();
        let guard = binding.read().await;
        assert!(
            guard.container_state.service_for(&open).is_some(),
            "registering another book closed the one being read"
        );
    }

    /// The book `open_book` reads back after recording it, as id 7.
    fn stored_book(file_path: &str, reading_direction: Option<Direction>) -> BookWithState {
        BookWithState {
            id: 7,
            file_path: file_path.to_string(),
            item_type: ItemType::Directory,
            display_name: "name".to_string(),
            total_pages: 2,
            series_id: None,
            series_order: None,
            thumbnail_path: None,
            created_at: None,
            is_spread_shifted: false,
            landscape_bits: None,
            reading_direction,
            last_read_page_index: Some(0),
            last_opened_at: None,
            cfi: None,
            tag_ids: vec![],
        }
    }

    /// A repository that records any book as id 7 and reads back [`stored_book`].
    fn recording_repo(file_path: &str, reading_direction: Option<Direction>) -> MockBookRepository {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_record_opened()
            .returning(|_, _, _, _, _| Ok(7));
        let stored = stored_book(file_path, reading_direction);
        mock_repo
            .expect_get_book_with_state_by_id()
            .with(mockall::predicate::eq(7))
            .returning(move |_| Ok(Some(stored.clone())));
        mock_repo
    }

    /// Manages `mock_repo`, an empty app state and `settings` as the current settings.
    fn manage_for_opening(
        app: &tauri::App<tauri::test::MockRuntime>,
        mock_repo: MockBookRepository,
        settings: AppSettings,
    ) {
        app.manage(CurrentSettings::new(settings));
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));
    }

    /// Settings whose default comic direction is `ltr`, with history on.
    fn ltr_settings() -> AppSettings {
        let mut settings = AppSettings::default();
        settings.reader.comic.reading_direction = Direction::Ltr;
        settings
    }

    /// The default settings with reading history off.
    fn history_off_settings() -> AppSettings {
        let mut settings = AppSettings::default();
        settings.history.record_reading_history = false;
        settings
    }

    #[tokio::test]
    async fn open_book_lists_the_book_and_records_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "My Book", 2);

        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_record_opened()
            .with(
                mockall::predicate::eq(path.clone()),
                mockall::predicate::eq(ItemType::Directory),
                mockall::predicate::eq("My Book"),
                mockall::predicate::eq(2),
                mockall::predicate::always(),
            )
            .times(1)
            .returning(|_, _, _, _, _| Ok(7));
        let stored = stored_book(&path, Some(Direction::Rtl));
        mock_repo
            .expect_get_book_with_state_by_id()
            .with(mockall::predicate::eq(7))
            .returning(move |_| Ok(Some(stored.clone())));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_opening(&app, mock_repo, ltr_settings());
        let events = record_events(app.handle());

        let opened = open_book(
            path.clone(),
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.entries, ["p1.png", "p2.png"]);
        assert!(opened.is_directory);
        assert!(!opened.is_novel);
        assert!(opened.record_error.is_none());
        let book = opened.book.unwrap();
        assert_eq!(book.id, 7);
        assert_eq!(book.file_path, path);
        assert_eq!(book.reading_direction, Some(Direction::Rtl));
        assert_eq!(
            *events.lock().unwrap(),
            [BooksChanged::NAME, ReadingHistoryChanged::NAME]
        );
    }

    #[tokio::test]
    async fn open_book_seeds_the_default_direction() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = recording_repo(&path, None);
        mock_repo
            .expect_update_reading_direction()
            .with(
                mockall::predicate::eq(7),
                mockall::predicate::eq(Direction::Ltr),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_opening(&app, mock_repo, ltr_settings());

        let opened = open_book(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.book.unwrap().reading_direction, Some(Direction::Ltr));
    }

    #[tokio::test]
    async fn open_book_keeps_a_stored_direction() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = recording_repo(&path, Some(Direction::Rtl));
        mock_repo.expect_update_reading_direction().times(0);

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_opening(&app, mock_repo, ltr_settings());

        let opened = open_book(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.book.unwrap().reading_direction, Some(Direction::Rtl));
    }

    #[tokio::test]
    async fn recording_a_novel_leaves_its_direction_unset() {
        use crate::container::traits::MockContainer;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("novel.epub").to_string_lossy().into_owned();
        let mut mock_repo = recording_repo(&path, None);
        mock_repo.expect_update_reading_direction().times(0);

        let mut container = MockContainer::new();
        container
            .expect_get_entries()
            .return_const(Vec::<String>::new());
        container.expect_is_directory().return_const(false);
        container.expect_is_novel().return_const(true);
        container.expect_max_readers().return_const(usize::MAX);

        let app = tauri::test::mock_app();
        manage_for_opening(&app, mock_repo, ltr_settings());

        let book = record_opened_book(
            &path,
            Arc::new(container),
            app.state::<Arc<dyn BookRepository>>().inner().as_ref(),
            app.handle(),
            &ltr_settings(),
        )
        .await
        .unwrap();

        assert_eq!(book.reading_direction, None);
    }

    #[tokio::test]
    async fn open_book_keeps_the_seeded_direction_when_storing_it_fails() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = recording_repo(&path, None);
        mock_repo
            .expect_update_reading_direction()
            .times(1)
            .returning(|_, _| Err(Error::Other("database is locked".to_string())));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_opening(&app, mock_repo, ltr_settings());

        let opened = open_book(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.book.unwrap().reading_direction, Some(Direction::Ltr));
    }

    #[tokio::test]
    async fn open_book_only_registers_the_book_while_history_is_off() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = MockBookRepository::new();
        mock_repo.expect_record_opened().times(0);
        mock_repo
            .expect_register()
            .times(1)
            .returning(|_, _, _, _, _| Ok(7));
        let stored = stored_book(&path, Some(Direction::Rtl));
        mock_repo
            .expect_get_book_with_state_by_id()
            .returning(move |_| Ok(Some(stored.clone())));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_opening(&app, mock_repo, history_off_settings());
        let events = record_events(app.handle());

        let opened = open_book(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.book.unwrap().id, 7);
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn open_book_seeds_the_default_direction_while_history_is_off() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = MockBookRepository::new();
        mock_repo.expect_record_opened().times(0);
        mock_repo
            .expect_register()
            .times(1)
            .returning(|_, _, _, _, _| Ok(7));
        let stored = stored_book(&path, None);
        mock_repo
            .expect_get_book_with_state_by_id()
            .returning(move |_| Ok(Some(stored.clone())));
        mock_repo
            .expect_update_reading_direction()
            .with(
                mockall::predicate::eq(7),
                mockall::predicate::eq(Direction::Ltr),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        let mut settings = history_off_settings();
        settings.reader.comic.reading_direction = Direction::Ltr;
        manage_for_opening(&app, mock_repo, settings);
        let events = record_events(app.handle());

        let opened = open_book(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.book.unwrap().reading_direction, Some(Direction::Ltr));
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn open_book_keeps_the_pages_when_recording_fails() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_record_opened()
            .returning(|_, _, _, _, _| Err(Error::Other("database is locked".to_string())));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_opening(&app, mock_repo, ltr_settings());
        let events = record_events(app.handle());

        let opened = open_book(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(opened.entries.len(), 2);
        assert!(opened.book.is_none());
        assert!(matches!(opened.record_error, Some(Error::Other(_))));
        assert!(events.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn open_book_refuses_a_missing_path() {
        let dir = tempfile::tempdir().unwrap();
        let mut mock_repo = MockBookRepository::new();
        mock_repo.expect_record_opened().times(0);
        mock_repo.expect_register().times(0);

        let app = tauri::test::mock_app();
        manage_for_opening(&app, mock_repo, ltr_settings());

        let result = open_book(
            dir.path().join("gone.zip").to_string_lossy().into_owned(),
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await;

        assert!(matches!(result, Err(Error::PathNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_book_error() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Err(sqlx::Error::RowNotFound.into()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = get_book(1, state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }

    #[tokio::test]
    async fn test_delete_book_error() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(None));
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Err(sqlx::Error::PoolTimedOut.into()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let repo = app.state::<Arc<dyn BookRepository>>();

        let result = delete_book(1, repo, app.handle().clone()).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }
}
