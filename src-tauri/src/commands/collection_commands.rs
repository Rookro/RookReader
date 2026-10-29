use std::sync::Arc;
use tauri::State;

use crate::commands::events::{emit, BooksChanged, CollectionsChanged};
use crate::domain::collection::entity::Collection;
use crate::domain::collection::repository::CollectionRepository;
use crate::error::Result;

/// Creates a new collection and returns its complete entity.
///
/// # Arguments
///
/// * `name` - The name of the new collection.
/// * `icon_id` - The string identifier for the UI icon.
/// * `repo` - The managed collection repository state.
///
/// # Returns
///
/// A `Result` containing the newly created `Collection` entity.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn create_collection<R: tauri::Runtime>(
    name: String,
    icon_id: String,
    repo: State<'_, Arc<dyn CollectionRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<Collection> {
    log::debug!("Create collection. (name:{}, icon_id:{})", name, icon_id);
    let collection = repo.create(&name, &icon_id).await?;
    emit(&app, &CollectionsChanged);
    Ok(collection)
}

/// Retrieves all collections from the database.
///
/// # Arguments
///
/// * `repo` - The managed collection repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Collection` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn get_all_collections(
    repo: State<'_, Arc<dyn CollectionRepository>>,
) -> Result<Vec<Collection>> {
    log::debug!("Get all collections");
    repo.get_all().await
}

/// Adds a book to a specific collection.
///
/// # Arguments
///
/// * `collection_id` - The ID of the collection.
/// * `book_id` - The ID of the book to add.
/// * `repo` - The managed collection repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
#[specta::specta]
pub async fn add_book_to_collection<R: tauri::Runtime>(
    collection_id: i64,
    book_id: i64,
    repo: State<'_, Arc<dyn CollectionRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!(
        "Add book to collection. (collection_id:{}, book_id:{})",
        collection_id,
        book_id
    );
    repo.add_book_to_collection(collection_id, book_id).await?;
    emit(&app, &BooksChanged);
    Ok(())
}

/// Removes a book from a specific collection.
///
/// # Arguments
///
/// * `collection_id` - The ID of the collection.
/// * `book_id` - The ID of the book to remove.
/// * `repo` - The managed collection repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn remove_book_from_collection<R: tauri::Runtime>(
    collection_id: i64,
    book_id: i64,
    repo: State<'_, Arc<dyn CollectionRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!(
        "Remove book from collection. (collection_id:{}, book_id:{})",
        collection_id,
        book_id
    );
    repo.remove_book_from_collection(collection_id, book_id)
        .await?;
    emit(&app, &BooksChanged);
    Ok(())
}

/// Retrieves the IDs of the collections that contain a book.
///
/// # Arguments
///
/// * `book_id` - The ID of the book.
/// * `repo` - The managed collection repository state.
///
/// # Returns
///
/// A `Result` containing the collection IDs.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn get_collections_for_book(
    book_id: i64,
    repo: State<'_, Arc<dyn CollectionRepository>>,
) -> Result<Vec<i64>> {
    log::debug!("Get collections for book. (book_id:{})", book_id);
    repo.get_collections_for_book(book_id).await
}

/// Replaces the collections that contain a book with the given ones.
///
/// # Arguments
///
/// * `book_id` - The ID of the book.
/// * `collection_ids` - The IDs of the collections that should contain the book.
/// * `repo` - The managed collection repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn set_collections_for_book<R: tauri::Runtime>(
    book_id: i64,
    collection_ids: Vec<i64>,
    repo: State<'_, Arc<dyn CollectionRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!(
        "Set collections for book. (book_id:{}, collection_ids:{:?})",
        book_id,
        collection_ids
    );
    repo.set_collections_for_book(book_id, &collection_ids)
        .await?;
    emit(&app, &BooksChanged);
    Ok(())
}

/// Deletes a collection from the database.
///
/// # Arguments
///
/// * `id` - The ID of the collection to delete.
/// * `repo` - The managed collection repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
#[specta::specta]
pub async fn delete_collection<R: tauri::Runtime>(
    id: i64,
    repo: State<'_, Arc<dyn CollectionRepository>>,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    log::debug!("Delete collection. (id:{})", id);
    repo.delete(id).await?;
    emit(&app, &CollectionsChanged);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::events::test_support::record_events;
    use crate::domain::collection::repository::MockCollectionRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;
    use tauri_specta::Event;

    #[tokio::test]
    async fn test_create_collection() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_create()
            .with(
                mockall::predicate::eq("shelf1"),
                mockall::predicate::eq("icon1"),
            )
            .times(1)
            .returning(|name, icon_id| {
                Ok(Collection {
                    id: 1,
                    name: name.to_string(),
                    icon_id: icon_id.to_string(),
                    created_at: None,
                })
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();
        let events = record_events(app.handle());

        let result = create_collection(
            "shelf1".to_string(),
            "icon1".to_string(),
            state,
            app.handle().clone(),
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [CollectionsChanged::NAME]);
        let collection = result.unwrap();
        assert_eq!(collection.id, 1);
        assert_eq!(collection.name, "shelf1");
        assert_eq!(collection.icon_id, "icon1");
    }

    #[tokio::test]
    async fn test_get_all_collections() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo.expect_get_all().times(1).returning(|| {
            Ok(vec![
                Collection {
                    id: 1,
                    name: "shelf1".to_string(),
                    icon_id: "icon1".to_string(),
                    created_at: None,
                },
                Collection {
                    id: 2,
                    name: "shelf2".to_string(),
                    icon_id: "icon2".to_string(),
                    created_at: None,
                },
            ])
        });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();

        let result = get_all_collections(state).await;
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
    async fn test_add_book_to_collection() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_add_book_to_collection()
            .with(mockall::predicate::eq(1), mockall::predicate::eq(2))
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();
        let events = record_events(app.handle());

        let result = add_book_to_collection(1, 2, state, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn test_remove_book_from_collection() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_remove_book_from_collection()
            .with(mockall::predicate::eq(1), mockall::predicate::eq(2))
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();
        let events = record_events(app.handle());

        let result = remove_book_from_collection(1, 2, state, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn test_get_collections_for_book() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_get_collections_for_book()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(vec![2, 3]));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();

        let result = get_collections_for_book(1, state).await;
        assert_eq!(result.unwrap(), vec![2, 3]);
    }

    #[tokio::test]
    async fn test_set_collections_for_book() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_set_collections_for_book()
            .withf(|book_id, collection_ids| *book_id == 1 && collection_ids == [2, 3])
            .times(1)
            .returning(|_, _| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();
        let events = record_events(app.handle());

        let result = set_collections_for_book(1, vec![2, 3], state, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [BooksChanged::NAME]);
    }

    #[tokio::test]
    async fn test_delete_collection() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();
        let events = record_events(app.handle());

        let result = delete_collection(1, state, app.handle().clone()).await;
        assert!(result.is_ok());
        assert_eq!(*events.lock().unwrap(), [CollectionsChanged::NAME]);
    }

    #[tokio::test]
    async fn test_create_collection_error() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_create()
            .with(
                mockall::predicate::eq("shelf1"),
                mockall::predicate::eq("icon1"),
            )
            .times(1)
            .returning(|_, _| Err(sqlx::Error::RowNotFound.into()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();

        let result = create_collection(
            "shelf1".to_string(),
            "icon1".to_string(),
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
    async fn test_get_all_collections_error() {
        let mut mock_repo = MockCollectionRepository::new();
        mock_repo
            .expect_get_all()
            .times(1)
            .returning(|| Err(sqlx::Error::PoolTimedOut.into()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn CollectionRepository>);
        let state = app.state::<Arc<dyn CollectionRepository>>();

        let result = get_all_collections(state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }
}
