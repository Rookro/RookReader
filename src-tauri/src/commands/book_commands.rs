use std::sync::Arc;
use tokio::sync::RwLock;

use tauri::State;

use crate::blocking::run_blocking;
use crate::commands::events::{emit, BooksChanged, ReadingHistoryChanged, ReadingProgressChanged};
use crate::container::describe::describe;
use crate::domain::book::entity::{Book, BookWithState, Direction, ReadBook, ReadingState};
use crate::domain::book::repository::BookRepository;
use crate::domain::collection::repository::CollectionRepository;
use crate::domain::series::repository::SeriesRepository;
use crate::domain::tag::repository::TagRepository;
use crate::error::{Error, Result};
use crate::infrastructure::thumbnails;
use crate::settings::{AppSettings, SettingsFileProvider};
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
        .register_book(
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

/// Records the event of a book being opened, updating its last opened time.
///
/// The book's item type, display name, and page count are read from its container. A
/// comic opened for the first time gets the reader's default page direction, which is
/// stored with it.
///
/// # Arguments
///
/// * `file_path` - The unique file or directory path.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
/// * `state` - The managed app state.
/// * `provider` - The settings file the default page direction is read from.
///
/// # Returns
///
/// A `Result` containing the book with its reading state.
///
/// # Errors
///
/// Returns an `Err` if the container cannot be opened, `EmptyContainer` when it holds no
/// readable pages, or an `Err` if recording or reading back the book fails. Failing to
/// read the default direction or to store it is logged, not returned.
#[tauri::command]
#[specta::specta]
pub async fn record_book_opened<R: tauri::Runtime>(
    file_path: String,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle<R>,
    state: State<'_, RwLock<AppState>>,
    provider: State<'_, SettingsFileProvider>,
) -> Result<BookWithState> {
    log::debug!("Record book opened: {}", file_path);

    let container = ContainerState::container_for(&state, &file_path).await?;
    let description = describe(&file_path, container.as_ref())?;
    let thumbnail_path = thumbnails::cover_for(&app, &file_path, container).await;

    let book_id = repo
        .record_book_opened(
            &file_path,
            description.item_type,
            &description.display_name,
            description.total_pages,
            thumbnail_path,
        )
        .await?;
    let mut book = repo
        .get_book_with_state_by_id(book_id)
        .await?
        .ok_or_else(|| Error::Other(format!("Book {book_id} vanished after it was recorded")))?;

    // A novel's direction is the EPUB's own and cannot be overridden.
    if !description.is_novel && book.reading_direction.is_none() {
        if let Some(direction) = default_reading_direction(&provider).await {
            if let Err(e) = repo.update_reading_direction(book_id, direction).await {
                log::warn!("Could not store the reading direction of book {book_id}: {e}");
            }
            book.reading_direction = Some(direction);
        }
    }

    emit(&app, &BooksChanged);
    emit(&app, &ReadingHistoryChanged);

    Ok(book)
}

/// The page direction a comic opens with when it has none of its own, or `None` (logged)
/// when the settings cannot be read.
async fn default_reading_direction(provider: &SettingsFileProvider) -> Option<Direction> {
    let provider = provider.clone();
    let loaded = run_blocking(move || AppSettings::load(&provider)).await;
    match loaded {
        Ok(settings) => Some(settings.reader.comic.reading_direction),
        Err(e) => {
            log::warn!("Could not read the default reading direction: {e}");
            None
        }
    }
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

/// Retrieves all books contained within a specific collection, including their reading states.
///
/// # Arguments
///
/// * `collection_id` - The ID of the collection.
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `BookWithState` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_books_with_state_by_collection_id(
    collection_id: i64,
    repo: State<'_, Arc<dyn CollectionRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!(
        "Get books with state by collection id({:?}).",
        collection_id
    );
    repo.get_books_by_collection(collection_id).await
}

/// Retrieves all books associated with a specific tag, including their reading states.
///
/// # Arguments
///
/// * `tag_id` - The unique identifier of the tag to filter by.
/// * `repo` - The managed tag repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `BookWithState` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_books_with_state_by_tag_id(
    tag_id: i64,
    repo: State<'_, Arc<dyn TagRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get books with state by tag id({:?}).", tag_id);
    repo.get_books_by_tag(tag_id).await
}

/// Retrieves all books belonging to a specific series, including their reading states.
///
/// # Arguments
///
/// * `series_id` - The unique identifier of the series to filter by.
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `BookWithState` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_books_with_state_by_series_id(
    series_id: i64,
    repo: State<'_, Arc<dyn SeriesRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get books with state by series id({:?}).", series_id);
    repo.get_books_by_series(series_id).await
}

/// Retrieves the IDs of all tags associated with a specific book.
///
/// # Arguments
///
/// * `book_id` - The unique identifier of the book.
/// * `repo` - The managed tag repository state.
///
/// # Returns
///
/// A `Result` containing a vector of tag IDs.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_book_tags(
    book_id: i64,
    repo: State<'_, Arc<dyn TagRepository>>,
) -> Result<Vec<i64>> {
    log::debug!("Get book tags of {:?}.", book_id);
    repo.get_tags_for_book(book_id).await
}

/// Updates the tags associated with a specific book.
///
/// # Arguments
///
/// * `book_id` - The unique identifier of the book.
/// * `tag_ids` - A list of tag IDs to associate with the book.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn update_book_tags<R: tauri::Runtime>(
    book_id: i64,
    tag_ids: Vec<i64>,
    repo: State<'_, Arc<dyn TagRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!(
        "Update book tags. (book id:{:?}, tag ids:{:?})",
        book_id,
        tag_ids
    );
    repo.attach_tags_to_book(book_id, &tag_ids).await?;
    emit(&app, &BooksChanged);
    Ok(())
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
    repo.delete_book(id).await?;
    if let Some(path) = thumbnail_path {
        thumbnails::remove(path).await;
    }
    emit(&app, &BooksChanged);
    emit(&app, &ReadingHistoryChanged);
    Ok(())
}

/// Updates the series associated with a specific book.
///
/// # Arguments
///
/// * `book_id` - The unique identifier of the book.
/// * `series_id` - The unique identifier of the series to associate with the book, or `None` to remove.
/// * `repo` - The managed series repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn update_book_series<R: tauri::Runtime>(
    book_id: i64,
    series_id: Option<i64>,
    repo: State<'_, Arc<dyn SeriesRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!(
        "Update book series. (book id:{:?}, series id:{:?})",
        book_id,
        series_id
    );
    repo.assign_book_to_series(book_id, series_id).await?;
    emit(&app, &BooksChanged);
    Ok(())
}

/// Updates the `series_order` for a given list of book IDs.
///
/// # Arguments
///
/// * `book_ids` - A list of book IDs in the desired order.
/// * `repo` - The managed series repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn update_series_orders<R: tauri::Runtime>(
    book_ids: Vec<i64>,
    repo: State<'_, Arc<dyn SeriesRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Update series orders for books: {:?}", book_ids);
    repo.update_book_orders_in_series(book_ids).await?;
    emit(&app, &BooksChanged);
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::commands::events::test_support::record_events;
    use crate::domain::book::entity::ItemType;
    use crate::domain::book::repository::MockBookRepository;
    use crate::domain::collection::repository::MockCollectionRepository;
    use crate::domain::series::repository::MockSeriesRepository;
    use crate::domain::tag::repository::MockTagRepository;
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
            .expect_delete_book()
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
            .expect_delete_book()
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
    async fn test_update_book_series() {
        let mut mock_repo = MockSeriesRepository::new();
        mock_repo
            .expect_assign_book_to_series()
            .with(mockall::predicate::eq(1), mockall::predicate::eq(Some(10)))
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let repo = app.state::<Arc<dyn SeriesRepository>>();
        let events = record_events(app.handle());

        let result = update_book_series(1, Some(10), repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn test_update_series_orders() {
        let mut mock_repo = MockSeriesRepository::new();
        mock_repo
            .expect_update_book_orders_in_series()
            .with(mockall::predicate::eq(vec![1, 2, 3]))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let repo = app.state::<Arc<dyn SeriesRepository>>();
        let events = record_events(app.handle());

        let result = update_series_orders(vec![1, 2, 3], repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn test_update_book_tags() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_attach_tags_to_book()
            .with(
                mockall::predicate::eq(1),
                mockall::predicate::eq(vec![2, 3]),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let repo = app.state::<Arc<dyn TagRepository>>();
        let events = record_events(app.handle());

        let result = update_book_tags(1, vec![2, 3], repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
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
    async fn test_get_book_tags() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_get_tags_for_book()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![1, 2, 3]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = get_book_tags(1, state).await;
        assert!(result.is_ok());
        let tags = result.unwrap();
        assert_eq!(tags.len(), 3);
        assert_eq!(tags, vec![1, 2, 3]);
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

    #[tokio::test]
    async fn test_get_books_with_state_by_collection_id() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_get_books_by_collection()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();

        let result = get_books_with_state_by_collection_id(1, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_books_with_state_by_tag_id() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_get_books_by_tag()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = get_books_with_state_by_tag_id(1, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_books_with_state_by_series_id() {
        let mut mock_repo = MockSeriesRepository::new();
        mock_repo
            .expect_get_books_by_series()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let state = app.state::<Arc<dyn SeriesRepository>>();

        let result = get_books_with_state_by_series_id(1, state).await;
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
                crate::setup::app_data_dir(app)
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
            .expect_register_book()
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
        mock_repo.expect_register_book().times(0);

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
        mock_repo
            .expect_register_book()
            .returning(|_, _, _, _, _| Ok(2));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &other);
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));
        crate::commands::container_commands::open_container(&open, app.state())
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

    /// The book `record_book_opened` reads back after recording it, as id 7.
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
            .expect_record_book_opened()
            .returning(|_, _, _, _, _| Ok(7));
        let stored = stored_book(file_path, reading_direction);
        mock_repo
            .expect_get_book_with_state_by_id()
            .with(mockall::predicate::eq(7))
            .returning(move |_| Ok(Some(stored.clone())));
        mock_repo
    }

    /// Manages `mock_repo`, an empty app state, and a settings file in `dir` whose comic
    /// reading direction is `ltr`.
    fn manage_for_recording(
        app: &tauri::App<tauri::test::MockRuntime>,
        dir: &std::path::Path,
        mock_repo: MockBookRepository,
    ) {
        use crate::settings::SettingsStoreProvider;

        let provider = SettingsFileProvider::at_path(dir.join("settings.json"));
        provider
            .save_all_settings(serde_json::json!({
                "reader": { "comic": { "readingDirection": "ltr" } }
            }))
            .unwrap();
        app.manage(provider);
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));
    }

    #[tokio::test]
    async fn record_book_opened_describes_the_book_and_returns_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "My Book", 2);

        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_record_book_opened()
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
        manage_for_recording(&app, dir.path(), mock_repo);
        let events = record_events(app.handle());

        let book = record_book_opened(
            path.clone(),
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(book.id, 7);
        assert_eq!(book.file_path, path);
        assert_eq!(book.reading_direction, Some(Direction::Rtl));
        assert_eq!(
            *events.lock().unwrap(),
            [BooksChanged::NAME, ReadingHistoryChanged::NAME]
        );
    }

    #[tokio::test]
    async fn record_book_opened_seeds_the_default_direction() {
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
        manage_for_recording(&app, dir.path(), mock_repo);

        let book = record_book_opened(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(book.reading_direction, Some(Direction::Ltr));
    }

    #[tokio::test]
    async fn record_book_opened_keeps_a_stored_direction() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = recording_repo(&path, Some(Direction::Rtl));
        mock_repo.expect_update_reading_direction().times(0);

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_recording(&app, dir.path(), mock_repo);

        let book = record_book_opened(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(book.reading_direction, Some(Direction::Rtl));
    }

    #[tokio::test]
    async fn record_book_opened_leaves_a_novel_direction_unset() {
        use crate::container::traits::MockContainer;
        use crate::image::resizer::ResizeFilter;
        use crate::page::pipeline::Pipeline;
        use crate::page::service::PageService;

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
        manage_for_recording(&app, dir.path(), mock_repo);
        app.state::<RwLock<AppState>>()
            .write()
            .await
            .container_state
            .install(PageService::new(
                path.clone(),
                Arc::new(container),
                Pipeline {
                    display: None,
                    max_image_height: 2000,
                    resize_method: ResizeFilter::Bilinear,
                },
                mini_moka::sync::Cache::new(100),
                0,
            ));

        let book = record_book_opened(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(book.reading_direction, None);
    }

    #[tokio::test]
    async fn record_book_opened_keeps_the_seeded_direction_when_storing_it_fails() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = recording_repo(&path, None);
        mock_repo
            .expect_update_reading_direction()
            .times(1)
            .returning(|_, _| Err(Error::Other("database is locked".to_string())));

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        manage_for_recording(&app, dir.path(), mock_repo);

        let book = record_book_opened(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(book.reading_direction, Some(Direction::Ltr));
    }

    #[tokio::test]
    async fn record_book_opened_skips_seeding_when_settings_cannot_be_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = png_folder(dir.path(), "Comic", 2);
        let mut mock_repo = recording_repo(&path, None);
        mock_repo.expect_update_reading_direction().times(0);

        let app = tauri::test::mock_app();
        let _thumbnail = ThumbnailCleanup::new(&app, &path);
        // A directory where the settings file should be cannot be read as one.
        let unreadable = dir.path().join("unreadable.json");
        fs::create_dir(&unreadable).unwrap();
        app.manage(SettingsFileProvider::at_path(unreadable));
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        app.manage(RwLock::new(AppState::default()));

        let book = record_book_opened(
            path,
            app.state(),
            app.handle().clone(),
            app.state(),
            app.state(),
        )
        .await
        .unwrap();

        assert_eq!(book.reading_direction, None);
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
            .expect_delete_book()
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
