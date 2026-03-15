use rookreader_lib::database::bookshelf::{BookshelfRepository, SqliteBookshelfRepository};
use sqlx::Row;

mod common;
use common::setup_db;

#[tokio::test]
async fn test_create_and_get_all_bookshelves() {
    let pool = setup_db().await;
    let repository = SqliteBookshelfRepository::new(pool.clone());

    // Create bookshelves
    let bs1 = repository.create("Favorites", "star").await.unwrap();
    assert_eq!(bs1.name, "Favorites");
    assert_eq!(bs1.icon_id, "star");
    assert!(bs1.created_at.is_some());

    let bs2 = repository.create("To Read", "book").await.unwrap();
    assert_eq!(bs2.name, "To Read");
    assert_eq!(bs2.icon_id, "book");

    // Get all bookshelves
    let bookshelves = repository.get_all().await.unwrap();
    assert_eq!(bookshelves.len(), 2);
    assert_eq!(bookshelves[0].name, "Favorites");
    assert_eq!(bookshelves[1].name, "To Read");
}

#[tokio::test]
async fn test_delete_bookshelf() {
    let pool = setup_db().await;
    let repository = SqliteBookshelfRepository::new(pool.clone());

    let bs1 = repository.create("Favorites", "star").await.unwrap();
    repository.create("To Read", "book").await.unwrap();

    repository.delete(bs1.id).await.unwrap();

    let bookshelves = repository.get_all().await.unwrap();
    assert_eq!(bookshelves.len(), 1);
    assert_eq!(bookshelves[0].name, "To Read");
}

#[tokio::test]
async fn test_add_and_remove_book_from_bookshelf() {
    let pool = setup_db().await;
    let repository = SqliteBookshelfRepository::new(pool.clone());

    // Create a bookshelf
    let bs = repository.create("Favorites", "star").await.unwrap();

    // Directly insert a book since we need an existing book ID for foreign keys
    let row = sqlx::query(
        r#"
        INSERT INTO books (file_path, item_type, display_name)
        VALUES ('/path/to/book2', 'file', 'My Book 2')
        RETURNING id
        "#,
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let book_id: i64 = row.get(0);

    // Add book to bookshelf
    repository
        .add_book_to_bookshelf(bs.id, book_id)
        .await
        .unwrap();

    // Verify it was added
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM bookshelf_items WHERE bookshelf_id = ? AND book_id = ?",
    )
    .bind(bs.id)
    .bind(book_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);

    // Remove book from bookshelf
    repository
        .remove_book_from_bookshelf(bs.id, book_id)
        .await
        .unwrap();

    // Verify it was removed
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM bookshelf_items WHERE bookshelf_id = ? AND book_id = ?",
    )
    .bind(bs.id)
    .bind(book_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 0);
}
