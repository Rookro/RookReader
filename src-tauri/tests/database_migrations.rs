use rookreader_lib::domain::bookshelf::repository::BookshelfRepository;
use rookreader_lib::infrastructure::database::bookshelf_repository::SqliteBookshelfRepository;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

/// The last migration before collections were renamed from bookshelves.
const BEFORE_RENAME: i64 = 20260922075400;

async fn memory_pool() -> SqlitePool {
    SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .expect("Failed to connect to in-memory SQLite")
}

async fn execute(pool: &SqlitePool, sql: &'static str) {
    sqlx::query(sql).execute(pool).await.unwrap();
}

async fn count(pool: &SqlitePool, sql: &'static str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
}

#[tokio::test]
async fn existing_collections_keep_their_books_after_the_rename() {
    let pool = memory_pool().await;
    sqlx::migrate!().run_to(BEFORE_RENAME, &pool).await.unwrap();
    execute(
        &pool,
        "INSERT INTO books (id, file_path, item_type, display_name, total_pages) VALUES \
         (1, '/a.zip', 'file', 'a', 1), (2, '/b.zip', 'file', 'b', 1)",
    )
    .await;
    execute(
        &pool,
        "INSERT INTO bookshelves (id, name, icon_id) VALUES (5, 'Favorites', 'star'), (9, 'Manga', 'book')",
    )
    .await;
    execute(
        &pool,
        "INSERT INTO bookshelf_items (bookshelf_id, book_id) VALUES (5, 1), (5, 2), (9, 2)",
    )
    .await;

    sqlx::migrate!().run(&pool).await.unwrap();

    let repository = SqliteBookshelfRepository::new(pool.clone());
    let collections = repository.get_all().await.unwrap();
    assert_eq!(
        collections
            .iter()
            .map(|c| (c.id, c.name.as_str(), c.icon_id.as_str()))
            .collect::<Vec<_>>(),
        [(5, "Favorites", "star"), (9, "Manga", "book")]
    );
    let mut books: Vec<i64> = repository
        .get_books_by_bookshelf(5)
        .await
        .unwrap()
        .iter()
        .map(|b| b.id)
        .collect();
    books.sort();
    assert_eq!(books, [1, 2]);
    let mut memberships = repository.get_bookshelves_for_book(2).await.unwrap();
    memberships.sort();
    assert_eq!(memberships, [5, 9]);
    // AUTOINCREMENT's sequence followed the rename, so a new id never reuses an old one.
    assert!(repository.create("New", "folder").await.unwrap().id > 9);

    repository.delete(5).await.unwrap();
    assert_eq!(
        count(
            &pool,
            "SELECT COUNT(*) FROM collection_items WHERE collection_id = 5"
        )
        .await,
        0
    );
    execute(&pool, "DELETE FROM books WHERE id = 2").await;
    assert_eq!(
        count(&pool, "SELECT COUNT(*) FROM collection_items").await,
        0
    );
}

#[tokio::test]
async fn reverting_the_rename_restores_the_bookshelf_tables() {
    let pool = memory_pool().await;
    sqlx::migrate!().run(&pool).await.unwrap();
    execute(
        &pool,
        "INSERT INTO books (id, file_path, item_type, display_name, total_pages) VALUES \
         (1, '/a.zip', 'file', 'a', 1)",
    )
    .await;
    execute(
        &pool,
        "INSERT INTO collections (id, name, icon_id) VALUES (5, 'Favorites', 'star')",
    )
    .await;
    execute(
        &pool,
        "INSERT INTO collection_items (collection_id, book_id) VALUES (5, 1)",
    )
    .await;

    sqlx::migrate!().undo(&pool, BEFORE_RENAME).await.unwrap();

    let shelves: Vec<(i64, String, String)> =
        sqlx::query_as("SELECT id, name, icon_id FROM bookshelves")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(shelves, [(5, "Favorites".to_string(), "star".to_string())]);
    let items: Vec<(i64, i64)> =
        sqlx::query_as("SELECT bookshelf_id, book_id FROM bookshelf_items")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(items, [(5, 1)]);
}
