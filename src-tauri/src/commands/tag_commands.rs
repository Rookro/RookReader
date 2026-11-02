use std::sync::Arc;
use tauri::State;

use crate::commands::events::{emit, BooksChanged, TagsChanged};
use crate::domain::book::entity::BookWithState;
use crate::domain::tag::entity::Tag;
use crate::domain::tag::repository::TagRepository;
use crate::error::Result;

/// Creates a new tag and returns its complete entity.
///
/// # Arguments
///
/// * `name` - The name of the new tag.
/// * `color_code` - The color code for the tag.
/// * `repo` - The managed tag repository state.
///
/// # Returns
///
/// A `Result` containing the newly created `Tag` entity.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn create_tag<R: tauri::Runtime>(
    name: String,
    color_code: String,
    repo: State<'_, Arc<dyn TagRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<Tag> {
    log::debug!("Create tag. (name:{}, color_code:{})", name, color_code);
    let tag = repo.create(&name, &color_code).await?;
    emit(&app, &TagsChanged);
    Ok(tag)
}

/// Retrieves all tags from the database.
///
/// # Arguments
///
/// * `repo` - The managed tag repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Tag` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_all_tags(repo: State<'_, Arc<dyn TagRepository>>) -> Result<Vec<Tag>> {
    log::debug!("Get all tags.");
    repo.get_all().await
}

/// Deletes a tag from the database.
///
/// # Arguments
///
/// * `id` - The ID of the tag to delete.
/// * `repo` - The managed tag repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn delete_tag<R: tauri::Runtime>(
    id: i64,
    repo: State<'_, Arc<dyn TagRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Delete tag. (id:{})", id);
    repo.delete(id).await?;
    emit(&app, &TagsChanged);
    emit(&app, &BooksChanged);
    Ok(())
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
pub async fn get_tags_for_book(
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
pub async fn set_tags_for_book<R: tauri::Runtime>(
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
    repo.set_tags_for_book(book_id, &tag_ids).await?;
    emit(&app, &BooksChanged);
    Ok(())
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
pub async fn get_books_by_tag(
    tag_id: i64,
    repo: State<'_, Arc<dyn TagRepository>>,
) -> Result<Vec<BookWithState>> {
    log::debug!("Get books with state by tag id({:?}).", tag_id);
    repo.get_books_by_tag(tag_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::events::test_support::record_events;
    use crate::domain::tag::repository::MockTagRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;
    use tauri_specta::Event;

    #[tokio::test]
    async fn test_create_tag() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_create()
            .with(
                mockall::predicate::eq("tag1"),
                mockall::predicate::eq("#FF0000"),
            )
            .times(1)
            .returning(|name, color| {
                Ok(Tag {
                    id: 1,
                    name: name.to_string(),
                    color_code: color.to_string(),
                })
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();
        let events = record_events(app.handle());

        let result = create_tag(
            "tag1".to_string(),
            "#FF0000".to_string(),
            state,
            app.handle().clone(),
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [TagsChanged::NAME]);
        let tag = result.unwrap();
        assert_eq!(tag.id, 1);
        assert_eq!(tag.name, "tag1");
        assert_eq!(tag.color_code, "#FF0000");
    }

    #[tokio::test]
    async fn test_get_all_tags() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo.expect_get_all().times(1).returning(|| {
            Ok(vec![
                Tag {
                    id: 1,
                    name: "tag1".to_string(),
                    color_code: "#FF0000".to_string(),
                },
                Tag {
                    id: 2,
                    name: "tag2".to_string(),
                    color_code: "#00FF00".to_string(),
                },
            ])
        });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = get_all_tags(state).await;
        assert!(result.is_ok());
        let tags = result.unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "tag1");
    }

    #[tokio::test]
    async fn test_delete_tag() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();
        let events = record_events(app.handle());

        let result = delete_tag(1, state, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(
            *events.lock().unwrap(),
            [TagsChanged::NAME, BooksChanged::NAME]
        );
    }

    #[tokio::test]
    async fn test_create_tag_error() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_create()
            .returning(|_, _| Err(sqlx::Error::RowNotFound.into()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = create_tag(
            "fail".to_string(),
            "fail".to_string(),
            state,
            app.handle().clone(),
        )
        .await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }

    #[tokio::test]
    async fn test_get_tags_for_book() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_get_tags_for_book()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![1, 2, 3]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = get_tags_for_book(1, state).await;
        assert!(result.is_ok());
        let tags = result.unwrap();
        assert_eq!(tags.len(), 3);
        assert_eq!(tags, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_set_tags_for_book() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_set_tags_for_book()
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

        let result = set_tags_for_book(1, vec![2, 3], repo, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn test_get_books_by_tag() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_get_books_by_tag()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = get_books_by_tag(1, state).await;
        assert!(result.is_ok());
    }
}
