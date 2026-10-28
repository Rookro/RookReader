use rookreader_lib::domain::book::entity::ItemType;
use rookreader_lib::domain::book::repository::BookRepository;
use rookreader_lib::domain::collection::repository::CollectionRepository;
use rookreader_lib::infrastructure::database::book_repository::SqliteBookRepository;
use rookreader_lib::infrastructure::database::collection_repository::SqliteCollectionRepository;
use sqlx::Row;

mod common;
use common::setup_db;

#[tokio::test]
async fn test_create_and_get_all_collections() {
    let pool = setup_db().await;
    let repository = SqliteCollectionRepository::new(pool.clone());

    // Create collections
    let bs1 = repository.create("Favorites", "star").await.unwrap();
    assert_eq!(bs1.name, "Favorites");
    assert_eq!(bs1.icon_id, "star");
    assert!(bs1.created_at.is_some());

    let bs2 = repository.create("To Read", "book").await.unwrap();
    assert_eq!(bs2.name, "To Read");
    assert_eq!(bs2.icon_id, "book");

    // Get all collections
    let collections = repository.get_all().await.unwrap();
    assert_eq!(collections.len(), 2);
    assert_eq!(collections[0].name, "Favorites");
    assert_eq!(collections[1].name, "To Read");
}

#[tokio::test]
async fn test_delete_collection() {
    let pool = setup_db().await;
    let repository = SqliteCollectionRepository::new(pool.clone());

    let bs1 = repository.create("Favorites", "star").await.unwrap();
    repository.create("To Read", "book").await.unwrap();

    repository.delete(bs1.id).await.unwrap();

    let collections = repository.get_all().await.unwrap();
    assert_eq!(collections.len(), 1);
    assert_eq!(collections[0].name, "To Read");
}

#[tokio::test]
async fn test_add_and_remove_book_from_collection() {
    let pool = setup_db().await;
    let repository = SqliteCollectionRepository::new(pool.clone());

    // Create a collection
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

    // Add book to collection
    repository
        .add_book_to_collection(bs.id, book_id)
        .await
        .unwrap();

    // Verify it was added
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM collection_items WHERE collection_id = ? AND book_id = ?",
    )
    .bind(bs.id)
    .bind(book_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);

    // Remove book from collection
    repository
        .remove_book_from_collection(bs.id, book_id)
        .await
        .unwrap();

    // Verify it was removed
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM collection_items WHERE collection_id = ? AND book_id = ?",
    )
    .bind(bs.id)
    .bind(book_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn test_set_collections_for_book_replaces_existing() {
    let pool = setup_db().await;
    let shelves = SqliteCollectionRepository::new(pool.clone());
    let books = SqliteBookRepository::new(pool.clone());

    let book_id = books
        .register_book("/path/to/book", ItemType::File, "Book", 1, None)
        .await
        .unwrap();
    let other_id = books
        .register_book("/path/to/other", ItemType::File, "Other", 1, None)
        .await
        .unwrap();
    let a = shelves.create("A", "star").await.unwrap();
    let b = shelves.create("B", "star").await.unwrap();
    let c = shelves.create("C", "star").await.unwrap();
    shelves.add_book_to_collection(a.id, book_id).await.unwrap();
    shelves.add_book_to_collection(b.id, book_id).await.unwrap();
    shelves
        .add_book_to_collection(a.id, other_id)
        .await
        .unwrap();

    shelves
        .set_collections_for_book(book_id, &[b.id, c.id])
        .await
        .unwrap();

    let mut set = shelves.get_collections_for_book(book_id).await.unwrap();
    set.sort_unstable();
    assert_eq!(set, vec![b.id, c.id]);
    // Another book's membership is left alone.
    assert_eq!(
        shelves.get_collections_for_book(other_id).await.unwrap(),
        vec![a.id]
    );
}

#[tokio::test]
async fn test_set_collections_for_book_skips_duplicate_and_nonexistent_ids() {
    let pool = setup_db().await;
    let shelves = SqliteCollectionRepository::new(pool.clone());
    let books = SqliteBookRepository::new(pool.clone());

    let book_id = books
        .register_book("/path/to/book", ItemType::File, "Book", 1, None)
        .await
        .unwrap();
    let a = shelves.create("A", "star").await.unwrap();

    let nonexistent_id = 9999;
    shelves
        .set_collections_for_book(book_id, &[a.id, a.id, nonexistent_id])
        .await
        .unwrap();

    assert_eq!(
        shelves.get_collections_for_book(book_id).await.unwrap(),
        vec![a.id]
    );
}

#[tokio::test]
async fn test_set_collections_for_book_with_empty_list_removes_all() {
    let pool = setup_db().await;
    let shelves = SqliteCollectionRepository::new(pool.clone());
    let books = SqliteBookRepository::new(pool.clone());

    let book_id = books
        .register_book("/path/to/book", ItemType::File, "Book", 1, None)
        .await
        .unwrap();
    let a = shelves.create("A", "star").await.unwrap();
    shelves.add_book_to_collection(a.id, book_id).await.unwrap();

    shelves
        .set_collections_for_book(book_id, &[])
        .await
        .unwrap();

    assert!(shelves
        .get_collections_for_book(book_id)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn test_set_collections_for_book_keeps_added_at_of_kept_collection() {
    let pool = setup_db().await;
    let shelves = SqliteCollectionRepository::new(pool.clone());
    let books = SqliteBookRepository::new(pool.clone());

    let book_id = books
        .register_book("/path/to/book", ItemType::File, "Book", 1, None)
        .await
        .unwrap();
    let a = shelves.create("A", "star").await.unwrap();
    let b = shelves.create("B", "star").await.unwrap();
    shelves.add_book_to_collection(a.id, book_id).await.unwrap();
    sqlx::query("UPDATE collection_items SET added_at = '2000-01-01 00:00:00'")
        .execute(&pool)
        .await
        .unwrap();

    shelves
        .set_collections_for_book(book_id, &[a.id, b.id])
        .await
        .unwrap();

    // A collection the book stays in keeps when the book was added to it.
    let added_at: String = sqlx::query_scalar(
        "SELECT added_at FROM collection_items WHERE collection_id = ? AND book_id = ?",
    )
    .bind(a.id)
    .bind(book_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(added_at, "2000-01-01 00:00:00");
}
