use std::sync::Arc;
use tauri::State;

use crate::domain::bookmark::entity::Bookmark;
use crate::domain::bookmark::repository::BookmarkRepository;
use crate::error::Result;

/// Creates a bookmark for a book and returns its complete entity.
///
/// # Arguments
///
/// * `book_id` - The identifier of the book to bookmark.
/// * `name` - The display name of the new bookmark.
/// * `page_index` - The comic page index, or the EPUB spine section index.
/// * `cfi` - The position within an EPUB section, or `None` for comics.
/// * `repo` - The managed bookmark repository state.
///
/// # Returns
///
/// A `Result` containing the newly created `Bookmark` entity.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn create_bookmark(
    book_id: i64,
    name: String,
    page_index: i64,
    cfi: Option<String>,
    repo: State<'_, Arc<dyn BookmarkRepository>>,
) -> Result<Bookmark> {
    log::debug!("Create bookmark. (book_id:{book_id}, page_index:{page_index})");
    repo.create(book_id, &name, page_index, cfi).await
}

/// Retrieves all bookmarks of a book, ordered by their position in the book.
///
/// # Arguments
///
/// * `book_id` - The identifier of the book.
/// * `repo` - The managed bookmark repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Bookmark` entities, empty if the book has none.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn get_bookmarks_by_book_id(
    book_id: i64,
    repo: State<'_, Arc<dyn BookmarkRepository>>,
) -> Result<Vec<Bookmark>> {
    log::debug!("Get bookmarks. (book_id:{book_id})");
    repo.get_by_book_id(book_id).await
}

/// Renames an existing bookmark.
///
/// # Arguments
///
/// * `id` - The ID of the bookmark to rename.
/// * `name` - The new display name.
/// * `repo` - The managed bookmark repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn rename_bookmark(
    id: i64,
    name: String,
    repo: State<'_, Arc<dyn BookmarkRepository>>,
) -> Result<()> {
    log::debug!("Rename bookmark. (id:{id})");
    repo.rename(id, &name).await
}

/// Deletes a bookmark from the database.
///
/// # Arguments
///
/// * `id` - The ID of the bookmark to delete.
/// * `repo` - The managed bookmark repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn delete_bookmark(id: i64, repo: State<'_, Arc<dyn BookmarkRepository>>) -> Result<()> {
    log::debug!("Delete bookmark. (id:{id})");
    repo.delete(id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::bookmark::repository::MockBookmarkRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;

    fn bookmark(id: i64, name: &str, page_index: i64, cfi: Option<String>) -> Bookmark {
        Bookmark {
            id,
            book_id: 1,
            name: name.to_string(),
            page_index,
            cfi,
            created_at: chrono::Utc::now().naive_utc(),
        }
    }

    #[tokio::test]
    async fn test_create_bookmark() {
        let mut mock_repo = MockBookmarkRepository::new();
        mock_repo
            .expect_create()
            .withf(|book_id, name, page_index, cfi| {
                *book_id == 1
                    && name == "Chapter 3"
                    && *page_index == 7
                    && cfi.as_deref() == Some("epubcfi(/6/8!/4/2/1:0)")
            })
            .times(1)
            .returning(|_, name, page_index, cfi| Ok(bookmark(10, name, page_index, cfi)));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookmarkRepository>);
        let state = app.state::<Arc<dyn BookmarkRepository>>();

        let result = create_bookmark(
            1,
            "Chapter 3".to_string(),
            7,
            Some("epubcfi(/6/8!/4/2/1:0)".to_string()),
            state,
        )
        .await;
        assert!(result.is_ok());
        let created = result.unwrap();
        assert_eq!(created.id, 10);
        assert_eq!(created.name, "Chapter 3");
        assert_eq!(created.page_index, 7);
        assert_eq!(created.cfi.as_deref(), Some("epubcfi(/6/8!/4/2/1:0)"));
    }

    #[tokio::test]
    async fn test_get_bookmarks_by_book_id() {
        let mut mock_repo = MockBookmarkRepository::new();
        mock_repo
            .expect_get_by_book_id()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| {
                Ok(vec![
                    bookmark(1, "Page 1", 0, None),
                    bookmark(2, "Page 9", 8, None),
                ])
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookmarkRepository>);
        let state = app.state::<Arc<dyn BookmarkRepository>>();

        let result = get_bookmarks_by_book_id(1, state).await;
        assert!(result.is_ok());
        let bookmarks = result.unwrap();
        assert_eq!(bookmarks.len(), 2);
        assert_eq!(bookmarks[0].name, "Page 1");
        assert_eq!(bookmarks[1].page_index, 8);
    }

    #[tokio::test]
    async fn test_rename_bookmark() {
        let mut mock_repo = MockBookmarkRepository::new();
        mock_repo
            .expect_rename()
            .with(
                mockall::predicate::eq(10),
                mockall::predicate::eq("The duel"),
            )
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookmarkRepository>);
        let state = app.state::<Arc<dyn BookmarkRepository>>();

        let result = rename_bookmark(10, "The duel".to_string(), state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_bookmark() {
        let mut mock_repo = MockBookmarkRepository::new();
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(10))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookmarkRepository>);
        let state = app.state::<Arc<dyn BookmarkRepository>>();

        let result = delete_bookmark(10, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_bookmark_error() {
        let mut mock_repo = MockBookmarkRepository::new();
        mock_repo
            .expect_create()
            .returning(|_, _, _, _| Err(crate::error::Error::Database(sqlx::Error::RowNotFound)));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookmarkRepository>);
        let state = app.state::<Arc<dyn BookmarkRepository>>();

        let result = create_bookmark(1, "fail".to_string(), 0, None, state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }
}
