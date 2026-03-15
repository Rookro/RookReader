use rookreader_lib::database::book::{BookRepository, ReadingState, SqliteBookRepository};
use rookreader_lib::database::bookshelf::{BookshelfRepository, SqliteBookshelfRepository};
use rookreader_lib::database::tag::{SqliteTagRepository, TagRepository};

mod common;
use common::setup_db;

#[tokio::test]
async fn test_upsert_and_get_book() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    let book_id = repository
        .upsert_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let book = repository.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.file_path, "/path/to/book.epub");
    assert_eq!(book.display_name, "My Book");
    assert_eq!(book.total_pages, 100);

    let updated_book_id = repository
        .upsert_book(
            "/path/to/book.epub",
            "file",
            "Updated Book", // Should not be updated by upsert logic due to ON CONFLICT
            200,            // Should not be updated
            Some("/path/to/thumb".to_string()),
        )
        .await
        .unwrap();

    assert_eq!(book_id, updated_book_id);

    let book = repository
        .get_by_path("/path/to/book.epub")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(book.file_path, "/path/to/book.epub");
    // Only file_path and thumbnail_path are updated on conflict based on the query
    assert_eq!(book.display_name, "My Book");
    assert_eq!(book.total_pages, 100);
    assert_eq!(book.thumbnail_path.unwrap(), "/path/to/thumb");
}

#[tokio::test]
async fn test_reading_state() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    let book_id = repository
        .upsert_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let book_with_state = repository
        .get_book_with_state_by_id(book_id)
        .await
        .unwrap()
        .unwrap();
    assert!(book_with_state.last_read_page_index.is_none());

    let state = ReadingState {
        book_id,
        last_read_page_index: 50,
        last_opened_at: Some(chrono::Utc::now().naive_utc()),
    };
    repository.upsert_reading_state(&state).await.unwrap();

    let book_with_state = repository
        .get_book_with_state_by_id(book_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(book_with_state.last_read_page_index, Some(50));
    assert!(book_with_state.last_opened_at.is_some());

    repository.clear_reading_history(book_id).await.unwrap();
    let book_with_state = repository
        .get_book_with_state_by_id(book_id)
        .await
        .unwrap()
        .unwrap();
    assert!(book_with_state.last_read_page_index.is_none());
}

#[tokio::test]
async fn test_book_tags() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());
    let tag_repo = SqliteTagRepository::new(pool.clone());

    let book_id = repository
        .upsert_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let t1 = tag_repo.create("Sci-Fi", "#000").await.unwrap();
    let t2 = tag_repo.create("Fantasy", "#111").await.unwrap();

    repository
        .update_book_tags(book_id, &[t1.id, t2.id])
        .await
        .unwrap();

    let tags = repository.get_book_tags(book_id).await.unwrap();
    assert_eq!(tags.len(), 2);
    assert!(tags.contains(&t1.id));
    assert!(tags.contains(&t2.id));

    let book_with_state = repository
        .get_book_with_state_by_id(book_id)
        .await
        .unwrap()
        .unwrap();
    let tags_str = book_with_state.tag_ids_str.unwrap();
    assert!(tags_str.contains(&t1.id.to_string()));
    assert!(tags_str.contains(&t2.id.to_string()));

    repository
        .update_book_tags(book_id, &[t1.id])
        .await
        .unwrap();
    let tags = repository.get_book_tags(book_id).await.unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0], t1.id);
}

#[tokio::test]
async fn test_delete_book() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());
    let bs_repo = SqliteBookshelfRepository::new(pool.clone());
    let tag_repo = SqliteTagRepository::new(pool.clone());

    let book_id = repository
        .upsert_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let tag = tag_repo.create("Tag", "#000").await.unwrap();
    repository
        .update_book_tags(book_id, &[tag.id])
        .await
        .unwrap();

    let bs = bs_repo.create("Bookshelf", "icon").await.unwrap();
    bs_repo.add_book_to_bookshelf(bs.id, book_id).await.unwrap();

    repository
        .upsert_reading_state(&ReadingState {
            book_id,
            last_read_page_index: 10,
            last_opened_at: Some(chrono::Utc::now().naive_utc()),
        })
        .await
        .unwrap();

    repository.delete_book(book_id).await.unwrap();

    let book = repository.get_by_id(book_id).await.unwrap();
    assert!(book.is_none());

    let tags = repository.get_book_tags(book_id).await.unwrap();
    assert!(tags.is_empty());

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM bookshelf_items WHERE book_id = ?")
        .bind(book_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reading_state WHERE book_id = ?")
        .bind(book_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
}
