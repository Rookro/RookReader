use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Arc;
use tokio::sync::RwLock;

use pdfium_render::prelude::PdfRenderConfig;
use tauri::Manager;
use tauri::State;

use crate::container::traits::Container;
use crate::container::{
    directory_container::DirectoryContainer, epub_container::EpubContainer,
    pdf_container::PdfContainer, rar_container::RarContainer, zip_container::ZipContainer,
};
use crate::database::book::{Book, BookRepository, BookWithState, ReadBook, ReadingState};
use crate::error::{Error, Result};
use crate::state::app_state::AppState;

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
pub async fn get_book(id: i64, repo: State<'_, Arc<dyn BookRepository>>) -> Result<Option<Book>> {
    log::debug!("Get book by id({}).", id);
    Ok(repo.get_by_id(id).await?)
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
pub async fn get_book_by_path(
    file_path: String,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Option<Book>> {
    log::debug!("Get book by path({}).", file_path);
    Ok(repo.get_by_path(&file_path).await?)
}

/// Retrieves a book along with its reading state by its unique ID.
///
/// # Arguments
///
/// * `id` - The unique identifier of the book.
/// * `repo` - The managed book repository state.
///
/// # Returns
///
/// A `Result` which is `Ok` containing an `Option<BookWithState>`.
/// It evaluates to `Some(BookWithState)` if a matching book is found,
/// or `None` if no such book exists in the repository.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn get_book_with_state_by_id(
    id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Option<BookWithState>> {
    log::debug!("Get book with state by id({}).", id);
    Ok(repo.get_book_with_state_by_id(id).await?)
}

/// Registers a book or returns its ID if it already exists, without updating reading state.
///
/// # Arguments
///
/// * `file_path` - The unique file or directory path.
/// * `item_type` - The type of the item ('file' or 'directory').
/// * `display_name` - The display name of the book.
/// * `total_pages` - The total number of pages.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
/// * `state` - The managed app state.
///
/// # Returns
///
/// A `Result` containing the ID of the upserted book.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn upsert_book(
    file_path: String,
    item_type: String,
    display_name: String,
    total_pages: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle,
    state: State<'_, RwLock<AppState>>,
) -> Result<i64> {
    log::debug!(
        "Upsert the book: (file_path: {}, item_type: {}, display_name: {}, total_pages: {})",
        file_path,
        item_type,
        display_name,
        total_pages
    );

    let pdfium_path = {
        let state_lock = state.read().await;
        state_lock
            .container_state
            .settings
            .pdfium_library_path
            .clone()
    };

    let thumbnail_path = generate_and_save_thumbnail(app, file_path.clone(), pdfium_path)
        .await
        .unwrap_or_else(|e| {
            log::warn!("Thumbnail of {} generation failed: {}", file_path, e);
            None
        });

    Ok(repo
        .upsert_book(
            &file_path,
            &item_type,
            &display_name,
            total_pages,
            thumbnail_path,
        )
        .await?)
}

/// Registers a book when opened, or updates its last opened time if it already exists.
///
/// # Arguments
///
/// * `file_path` - The unique file or directory path.
/// * `item_type` - The type of the item ('file' or 'directory').
/// * `display_name` - The display name of the book.
/// * `total_pages` - The total number of pages.
/// * `repo` - The managed book repository state.
/// * `app` - The Tauri AppHandle.
/// * `state` - The managed app state.
///
/// # Returns
///
/// A `Result` containing the ID of the upserted read book
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn upsert_read_book(
    file_path: String,
    item_type: String,
    display_name: String,
    total_pages: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
    app: tauri::AppHandle,
    state: State<'_, RwLock<AppState>>,
) -> Result<i64> {
    log::debug!(
        "Upsert the read book: (file_path: {}, item_type: {}, display_name: {}, total_pages: {})",
        file_path,
        item_type,
        display_name,
        total_pages
    );

    let pdfium_path = {
        let state_lock = state.read().await;
        state_lock
            .container_state
            .settings
            .pdfium_library_path
            .clone()
    };

    let thumbnail_path = generate_and_save_thumbnail(app, file_path.clone(), pdfium_path)
        .await
        .unwrap_or_else(|e| {
            log::warn!("Thumbnail of {} generation failed: {}", file_path, e);
            None
        });

    Ok(repo
        .upsert_read_book(
            &file_path,
            &item_type,
            &display_name,
            total_pages,
            thumbnail_path,
        )
        .await?)
}

/// Clears the reading history for a specific book.
///
/// # Arguments
///
/// * `book_id` - The unique identifier of the book.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn clear_reading_history(
    book_id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<()> {
    log::debug!("Clear reading history of {:?}", book_id);
    Ok(repo.clear_reading_history(book_id).await?)
}

/// Clears the reading history for all books in the library.
///
/// # Arguments
///
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn clear_all_reading_history(repo: State<'_, Arc<dyn BookRepository>>) -> Result<()> {
    log::debug!("Clear all reading history");
    Ok(repo.clear_all_reading_history().await?)
}

/// Updates or inserts the reading state for a book.
///
/// # Arguments
///
/// * `state_data` - The `ReadingState` object sent from the frontend.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn upsert_reading_state(
    state_data: ReadingState,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<()> {
    log::debug!("Upsert reading state: {:?}", state_data);
    Ok(repo.upsert_reading_state(&state_data).await?)
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
pub async fn get_recently_read_books(
    limit: Option<i64>,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<ReadBook>> {
    log::debug!("Get recently read books(limit: {:?}).", limit);
    Ok(repo.get_recently_read_books(limit).await?)
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
pub async fn get_all_books_with_state(
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get all books with state.");
    Ok(repo.get_all_books_with_state().await?)
}

/// Retrieves all books contained within a specific bookshelf, including their reading states.
///
/// # Arguments
///
/// * `bookshelf_id` - The ID of the bookshelf.
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
pub async fn get_books_with_state_by_bookshelf_id(
    bookshelf_id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get books with state by bookshelf id({:?}).", bookshelf_id);
    Ok(repo
        .get_books_with_state_by_bookshelf_id(bookshelf_id)
        .await?)
}

/// Retrieves all books associated with a specific tag, including their reading states.
///
/// # Arguments
///
/// * `tag_id` - The unique identifier of the tag to filter by.
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
pub async fn get_books_with_state_by_tag_id(
    tag_id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get books with state by tag id({:?}).", tag_id);
    Ok(repo.get_books_with_state_by_tag_id(tag_id).await?)
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
pub async fn get_books_with_state_by_series_id(
    series_id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get books with state by series id({:?}).", series_id);
    Ok(repo.get_books_with_state_by_series_id(series_id).await?)
}

/// Retrieves the IDs of all tags associated with a specific book.
///
/// # Arguments
///
/// * `book_id` - The unique identifier of the book.
/// * `repo` - The managed book repository state.
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
pub async fn get_book_tags(
    book_id: i64,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<Vec<i64>> {
    log::debug!("Get book tags of {:?}.", book_id);
    Ok(repo.get_book_tags(book_id).await?)
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
pub async fn update_book_tags(
    book_id: i64,
    tag_ids: Vec<i64>,
    repo: State<'_, Arc<dyn BookRepository>>,
) -> Result<()> {
    log::debug!(
        "Update book tags. (book id:{:?}, tag ids:{:?})",
        book_id,
        tag_ids
    );
    Ok(repo.update_book_tags(book_id, &tag_ids).await?)
}

/// Deletes a book by its unique ID.
///
/// # Arguments
///
/// * `id` - The unique identifier of the book to delete.
/// * `repo` - The managed book repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn delete_book(id: i64, repo: State<'_, Arc<dyn BookRepository>>) -> Result<()> {
    log::debug!("Delete book by id({}).", id);
    Ok(repo.delete_book(id).await?)
}

/// Helper function to generate and save a thumbnail for a given file path.
async fn generate_and_save_thumbnail(
    app: tauri::AppHandle,
    file_path: String,
    pdfium_path: Option<String>,
) -> Result<Option<String>> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = std::path::Path::new(&file_path);
        let container: Arc<dyn Container> = if path.is_dir() {
            Arc::new(DirectoryContainer::new(&file_path)?)
        } else if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "zip" => Arc::new(ZipContainer::new(&file_path)?),
                "pdf" => Arc::new(PdfContainer::new(
                    &file_path,
                    PdfRenderConfig::default(),
                    pdfium_path,
                )?),
                "rar" => Arc::new(RarContainer::new(&file_path)?),
                "epub" => Arc::new(EpubContainer::new(&file_path)?),
                _ => {
                    return Err(Error::UnsupportedContainer(format!(
                        "Unsupported Format: {}",
                        file_path
                    )))
                }
            }
        } else {
            return Err(Error::UnsupportedContainer(format!(
                "No extension: {}",
                file_path
            )));
        };

        let first_image_entry = container.get_entries().first();
        if let Some(entry) = first_image_entry {
            let image = container.get_thumbnail(entry)?;
            let mut hasher = DefaultHasher::new();
            file_path.hash(&mut hasher);
            let hash = hasher.finish();

            let thumbnails_dir = app.path().app_data_dir()?.join("thumbnails");
            if !thumbnails_dir.exists() {
                fs::create_dir_all(&thumbnails_dir)?;
            }

            let thumbnail_filename = format!("thumbnail_{}.jpg", hash);
            let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);

            fs::write(&thumbnail_path, &image.data)?;

            Ok(Some(thumbnail_path.to_string_lossy().to_string()))
        } else {
            // EPUB Novel doesn't have any image.
            log::warn!("Failed to get thumbnail for {}. No image found.", file_path);
            Ok(None)
        }
    })
    .await
    .map_err(|e| Error::Other(format!("Spawn blocking failed: {}", e)))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::book::MockBookRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;

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
                    item_type: "file".to_string(),
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
            assert_eq!(book.item_type, "file");
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
                    item_type: "file".to_string(),
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
            assert_eq!(book.item_type, "file");
            assert_eq!(book.display_name, "name");
            assert_eq!(book.total_pages, 10);
            assert!(book.series_id.is_none());
            assert!(book.series_order.is_none());
            assert!(book.thumbnail_path.is_none());
        }
    }

    #[tokio::test]
    async fn test_delete_book() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_delete_book()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = delete_book(1, state).await;
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
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = clear_reading_history(1, state).await;
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
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = clear_all_reading_history(state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_book_tags() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_book_tags()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![1, 2, 3]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = get_book_tags(1, state).await;
        assert!(result.is_ok());
        let tags = result.unwrap();
        assert_eq!(tags.len(), 3);
        assert_eq!(tags, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_get_book_error() {
        let mut mock_repo = MockBookRepository::new();
        mock_repo
            .expect_get_by_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Err(sqlx::Error::RowNotFound));

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
            .expect_delete_book()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Err(sqlx::Error::PoolTimedOut));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookRepository>);
        let state = app.state::<Arc<dyn BookRepository>>();

        let result = delete_book(1, state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }
}
