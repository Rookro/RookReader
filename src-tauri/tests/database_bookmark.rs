use rookreader_lib::domain::book::repository::BookRepository;
use rookreader_lib::domain::bookmark::repository::BookmarkRepository;
use rookreader_lib::error::Error;
use rookreader_lib::infrastructure::database::book_repository::SqliteBookRepository;
use rookreader_lib::infrastructure::database::bookmark_repository::SqliteBookmarkRepository;

mod common;
use common::setup_db;

/// Registers a book and returns its id, so each test starts from a valid foreign key.
async fn setup_book(pool: &sqlx::SqlitePool, path: &str) -> i64 {
    SqliteBookRepository::new(pool.clone())
        .register_book(path, "file", "My Book", 100, None)
        .await
        .unwrap()
}

#[tokio::test]
async fn test_create_and_list_bookmarks() {
    let pool = setup_db().await;
    let repository = SqliteBookmarkRepository::new(pool.clone());
    let book_id = setup_book(&pool, "/path/to/book.epub").await;

    // Insert out of order to prove the listing sorts by position, not insertion order.
    let later = repository
        .create(
            book_id,
            "Chapter 3",
            7,
            Some("epubcfi(/6/8!/4/2/1:0)".to_string()),
        )
        .await
        .unwrap();
    let earlier = repository.create(book_id, "Page 2", 1, None).await.unwrap();

    assert_eq!(later.book_id, book_id);
    assert_eq!(later.name, "Chapter 3");
    assert_eq!(later.page_index, 7);
    assert_eq!(later.cfi.as_deref(), Some("epubcfi(/6/8!/4/2/1:0)"));
    assert!(earlier.cfi.is_none());

    let bookmarks = repository.get_by_book_id(book_id).await.unwrap();
    assert_eq!(bookmarks.len(), 2);
    assert_eq!(bookmarks[0].id, earlier.id);
    assert_eq!(bookmarks[0].page_index, 1);
    assert_eq!(bookmarks[1].id, later.id);
    assert_eq!(bookmarks[1].page_index, 7);
}

#[tokio::test]
async fn test_rename_bookmark() {
    let pool = setup_db().await;
    let repository = SqliteBookmarkRepository::new(pool.clone());
    let book_id = setup_book(&pool, "/path/to/book.zip").await;

    let bookmark = repository.create(book_id, "Page 5", 4, None).await.unwrap();
    repository.rename(bookmark.id, "The duel").await.unwrap();

    let bookmarks = repository.get_by_book_id(book_id).await.unwrap();
    assert_eq!(bookmarks.len(), 1);
    assert_eq!(bookmarks[0].name, "The duel");
    // Renaming must not disturb the stored position.
    assert_eq!(bookmarks[0].page_index, 4);
}

#[tokio::test]
async fn test_delete_bookmark() {
    let pool = setup_db().await;
    let repository = SqliteBookmarkRepository::new(pool.clone());
    let book_id = setup_book(&pool, "/path/to/book.zip").await;

    let first = repository.create(book_id, "Page 1", 0, None).await.unwrap();
    let second = repository.create(book_id, "Page 9", 8, None).await.unwrap();

    repository.delete(first.id).await.unwrap();

    let bookmarks = repository.get_by_book_id(book_id).await.unwrap();
    assert_eq!(bookmarks.len(), 1);
    assert_eq!(bookmarks[0].id, second.id);
}

#[tokio::test]
async fn test_get_bookmarks_for_unknown_book_returns_empty() {
    let pool = setup_db().await;
    let repository = SqliteBookmarkRepository::new(pool.clone());

    let bookmarks = repository.get_by_book_id(9999).await.unwrap();
    assert!(bookmarks.is_empty());
}

#[tokio::test]
async fn test_delete_book_removes_bookmarks() {
    let pool = setup_db().await;
    let repository = SqliteBookmarkRepository::new(pool.clone());
    let books = SqliteBookRepository::new(pool.clone());
    let book_id = setup_book(&pool, "/path/to/book.zip").await;

    repository.create(book_id, "Page 1", 0, None).await.unwrap();
    repository.create(book_id, "Page 9", 8, None).await.unwrap();

    books.delete_book(book_id).await.unwrap();

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM bookmarks WHERE book_id = ?")
        .bind(book_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn test_create_bookmark_for_missing_book_fails() {
    let pool = setup_db().await;
    let repository = SqliteBookmarkRepository::new(pool.clone());

    let err = repository
        .create(9999, "Page 1", 0, None)
        .await
        .unwrap_err();

    // The foreign key to books(id) rejects the insert.
    assert!(matches!(err, Error::Database(sqlx::Error::Database(_))));
}
