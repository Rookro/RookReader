use std::sync::Arc;
use tauri::State;

use crate::database::bookshelf::{Bookshelf, BookshelfRepository};
use crate::error::Result;

/// Creates a new bookshelf and returns its complete entity.
///
/// # Arguments
///
/// * `name` - The name of the new bookshelf.
/// * `icon_id` - The string identifier for the UI icon.
/// * `repo` - The managed bookshelf repository state.
///
/// # Returns
///
/// A `Result` containing the newly created `Bookshelf` entity.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn create_bookshelf(
    name: String,
    icon_id: String,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<Bookshelf> {
    log::debug!("Create bookshelf. (name:{}, icon_id:{})", name, icon_id);
    Ok(repo.create(&name, &icon_id).await?)
}

/// Retrieves all bookshelves from the database.
///
/// # Arguments
///
/// * `repo` - The managed bookshelf repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Bookshelf` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn get_all_bookshelves(
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<Vec<Bookshelf>> {
    log::debug!("Get all bookshelves");
    Ok(repo.get_all().await?)
}

/// Adds a book to a specific bookshelf.
///
/// # Arguments
///
/// * `bookshelf_id` - The ID of the bookshelf.
/// * `book_id` - The ID of the book to add.
/// * `repo` - The managed bookshelf repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn add_book_to_bookshelf(
    bookshelf_id: i64,
    book_id: i64,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<()> {
    log::debug!(
        "Add book to bookshelf. (bookshelf_id:{}, book_id:{})",
        bookshelf_id,
        book_id
    );
    Ok(repo.add_book_to_bookshelf(bookshelf_id, book_id).await?)
}

/// Removes a book from a specific bookshelf.
///
/// # Arguments
///
/// * `bookshelf_id` - The ID of the bookshelf.
/// * `book_id` - The ID of the book to remove.
/// * `repo` - The managed bookshelf repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn remove_book_from_bookshelf(
    bookshelf_id: i64,
    book_id: i64,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<()> {
    log::debug!(
        "Remove book from bookshelf. (bookshelf_id:{}, book_id:{})",
        bookshelf_id,
        book_id
    );
    Ok(repo
        .remove_book_from_bookshelf(bookshelf_id, book_id)
        .await?)
}

/// Deletes a bookshelf from the database.
///
/// # Arguments
///
/// * `id` - The ID of the bookshelf to delete.
/// * `repo` - The managed bookshelf repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn delete_bookshelf(
    id: i64,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<()> {
    log::debug!("Delete bookshelf. (id:{})", id);
    Ok(repo.delete(id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::bookshelf::MockBookshelfRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;

    #[tokio::test]
    async fn test_create_bookshelf() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo
            .expect_create()
            .with(
                mockall::predicate::eq("shelf1"),
                mockall::predicate::eq("icon1"),
            )
            .times(1)
            .returning(|name, icon_id| {
                Ok(Bookshelf {
                    id: 1,
                    name: name.to_string(),
                    icon_id: icon_id.to_string(),
                    created_at: None,
                })
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = create_bookshelf("shelf1".to_string(), "icon1".to_string(), state).await;
        assert!(result.is_ok());
        let shelf = result.unwrap();
        assert_eq!(shelf.id, 1);
        assert_eq!(shelf.name, "shelf1");
        assert_eq!(shelf.icon_id, "icon1");
    }

    #[tokio::test]
    async fn test_get_all_bookshelves() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo.expect_get_all().times(1).returning(|| {
            Ok(vec![
                Bookshelf {
                    id: 1,
                    name: "shelf1".to_string(),
                    icon_id: "icon1".to_string(),
                    created_at: None,
                },
                Bookshelf {
                    id: 2,
                    name: "shelf2".to_string(),
                    icon_id: "icon2".to_string(),
                    created_at: None,
                },
            ])
        });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = get_all_bookshelves(state).await;
        assert!(result.is_ok());
        let shelves = result.unwrap();
        assert_eq!(shelves.len(), 2);
        assert_eq!(shelves[0].id, 1);
        assert_eq!(shelves[0].name, "shelf1");
        assert_eq!(shelves[0].icon_id, "icon1");
        assert_eq!(shelves[1].id, 2);
        assert_eq!(shelves[1].name, "shelf2");
        assert_eq!(shelves[1].icon_id, "icon2");
    }

    #[tokio::test]
    async fn test_add_book_to_bookshelf() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo
            .expect_add_book_to_bookshelf()
            .with(mockall::predicate::eq(1), mockall::predicate::eq(2))
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = add_book_to_bookshelf(1, 2, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_remove_book_from_bookshelf() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo
            .expect_remove_book_from_bookshelf()
            .with(mockall::predicate::eq(1), mockall::predicate::eq(2))
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = remove_book_from_bookshelf(1, 2, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_bookshelf() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = delete_bookshelf(1, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_bookshelf_error() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo
            .expect_create()
            .with(
                mockall::predicate::eq("shelf1"),
                mockall::predicate::eq("icon1"),
            )
            .times(1)
            .returning(|_, _| Err(sqlx::Error::RowNotFound));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = create_bookshelf("shelf1".to_string(), "icon1".to_string(), state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }

    #[tokio::test]
    async fn test_get_all_bookshelves_error() {
        let mut mock_repo = MockBookshelfRepository::new();
        mock_repo
            .expect_get_all()
            .times(1)
            .returning(|| Err(sqlx::Error::PoolTimedOut));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn BookshelfRepository>);
        let state = app.state::<Arc<dyn BookshelfRepository>>();

        let result = get_all_bookshelves(state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }
}
