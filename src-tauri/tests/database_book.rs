use rookreader_lib::domain::book::entity::ReadingState;
use rookreader_lib::domain::book::repository::BookRepository;
use rookreader_lib::domain::bookshelf::repository::BookshelfRepository;
use rookreader_lib::domain::series::repository::SeriesRepository;
use rookreader_lib::domain::tag::repository::TagRepository;
use rookreader_lib::infrastructure::database::book_repository::SqliteBookRepository;
use rookreader_lib::infrastructure::database::bookshelf_repository::SqliteBookshelfRepository;
use rookreader_lib::infrastructure::database::series_repository::SqliteSeriesRepository;
use rookreader_lib::infrastructure::database::tag_repository::SqliteTagRepository;

mod common;
use common::setup_db;

#[tokio::test]
async fn test_register_and_get_book() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    let book_id = repository
        .register_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let book = repository.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.file_path, "/path/to/book.epub");
    assert_eq!(book.display_name, "My Book");
    assert_eq!(book.total_pages, 100);

    let updated_book_id = repository
        .register_book(
            "/path/to/book.epub",
            "file",
            "Updated Book", // Should not be updated by register logic due to ON CONFLICT
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
        .register_book("/path/to/book.epub", "file", "My Book", 100, None)
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
    repository.update_reading_progress(&state).await.unwrap();

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
async fn test_record_book_opened() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    // 1. New book
    let book_id = repository
        .record_book_opened("/path/to/read.epub", "file", "Read Book", 100, None)
        .await
        .unwrap();

    let book_with_state = repository
        .get_book_with_state_by_id(book_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(book_with_state.last_read_page_index, Some(0));
    assert!(book_with_state.last_opened_at.is_some());

    let first_opened_at = book_with_state.last_opened_at.unwrap();

    // 2. Existing book (should update last_opened_at)
    // Wait a bit to ensure timestamp changes (though in tests it might be too fast)
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    let book_id_2 = repository
        .record_book_opened("/path/to/read.epub", "file", "Read Book", 100, None)
        .await
        .unwrap();

    assert_eq!(book_id, book_id_2);

    let book_with_state = repository
        .get_book_with_state_by_id(book_id)
        .await
        .unwrap()
        .unwrap();
    assert!(book_with_state.last_opened_at.unwrap() > first_opened_at);
}

#[tokio::test]
async fn test_recently_read_books() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    let b1 = repository
        .register_book("/path/1", "file", "B1", 100, None)
        .await
        .unwrap();
    let b2 = repository
        .register_book("/path/2", "file", "B2", 100, None)
        .await
        .unwrap();
    let _b3 = repository
        .register_book("/path/3", "file", "B3", 100, None)
        .await
        .unwrap();

    let now = chrono::Utc::now().naive_utc();

    repository
        .update_reading_progress(&ReadingState {
            book_id: b1,
            last_read_page_index: 10,
            last_opened_at: Some(now - chrono::Duration::minutes(10)),
        })
        .await
        .unwrap();

    repository
        .update_reading_progress(&ReadingState {
            book_id: b2,
            last_read_page_index: 20,
            last_opened_at: Some(now),
        })
        .await
        .unwrap();

    // B3 has no reading state (unread)

    let recent = repository.get_recently_read_books(None).await.unwrap();
    assert_eq!(recent.len(), 2);
    assert_eq!(recent[0].id, b2); // Most recent
    assert_eq!(recent[1].id, b1);

    let recent_limited = repository.get_recently_read_books(Some(1)).await.unwrap();
    assert_eq!(recent_limited.len(), 1);
    assert_eq!(recent_limited[0].id, b2);
}

#[tokio::test]
async fn test_all_books_with_state() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    repository
        .register_book("/path/1", "file", "B1", 100, None)
        .await
        .unwrap();
    repository
        .register_book("/path/2", "file", "B2", 100, None)
        .await
        .unwrap();

    let books = repository.get_all_books_with_state().await.unwrap();
    assert_eq!(books.len(), 2);
}

#[tokio::test]
async fn test_filtering_by_bookshelf_tag_series() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());
    let bookshelf_repo = SqliteBookshelfRepository::new(pool.clone());
    let tag_repo = SqliteTagRepository::new(pool.clone());
    let series_repo = SqliteSeriesRepository::new(pool.clone());

    let b1 = repository
        .register_book("/path/1", "file", "B1", 100, None)
        .await
        .unwrap();
    let b2 = repository
        .register_book("/path/2", "file", "B2", 100, None)
        .await
        .unwrap();

    // Bookshelf
    let shelf = bookshelf_repo.create("Shelf", "icon").await.unwrap();
    bookshelf_repo
        .add_book_to_bookshelf(shelf.id, b1)
        .await
        .unwrap();

    let shelf_books = bookshelf_repo
        .get_books_by_bookshelf(shelf.id)
        .await
        .unwrap();
    assert_eq!(shelf_books.len(), 1);
    assert_eq!(shelf_books[0].id, b1);

    // Tag
    let tag = tag_repo.create("Tag", "#000").await.unwrap();
    tag_repo.attach_tags_to_book(b2, &[tag.id]).await.unwrap();

    let tag_books = tag_repo.get_books_by_tag(tag.id).await.unwrap();
    assert_eq!(tag_books.len(), 1);
    assert_eq!(tag_books[0].id, b2);

    // Series
    let series_id = series_repo.create("Series").await.unwrap();
    series_repo
        .assign_book_to_series(b1, Some(series_id))
        .await
        .unwrap();

    let series_books = series_repo.get_books_by_series(series_id).await.unwrap();
    assert_eq!(series_books.len(), 1);
    assert_eq!(series_books[0].id, b1);
}

#[tokio::test]
async fn test_clear_all_reading_history() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());

    let b1 = repository
        .register_book("/path/1", "file", "B1", 100, None)
        .await
        .unwrap();
    let now = chrono::Utc::now().naive_utc();

    repository
        .update_reading_progress(&ReadingState {
            book_id: b1,
            last_read_page_index: 10,
            last_opened_at: Some(now),
        })
        .await
        .unwrap();

    let recent = repository.get_recently_read_books(None).await.unwrap();
    assert_eq!(recent.len(), 1);

    repository.clear_all_reading_history().await.unwrap();

    let recent = repository.get_recently_read_books(None).await.unwrap();
    assert!(recent.is_empty());
}

#[tokio::test]
async fn test_book_tags() {
    let pool = setup_db().await;
    let repository = SqliteBookRepository::new(pool.clone());
    let tag_repo = SqliteTagRepository::new(pool.clone());

    let book_id = repository
        .register_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let t1 = tag_repo.create("Sci-Fi", "#000").await.unwrap();
    let t2 = tag_repo.create("Fantasy", "#111").await.unwrap();

    tag_repo
        .attach_tags_to_book(book_id, &[t1.id, t2.id])
        .await
        .unwrap();

    let tags = tag_repo.get_tags_for_book(book_id).await.unwrap();
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

    tag_repo
        .attach_tags_to_book(book_id, &[t1.id])
        .await
        .unwrap();
    let tags = tag_repo.get_tags_for_book(book_id).await.unwrap();
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
        .register_book("/path/to/book.epub", "file", "My Book", 100, None)
        .await
        .unwrap();

    let tag = tag_repo.create("Tag", "#000").await.unwrap();
    tag_repo
        .attach_tags_to_book(book_id, &[tag.id])
        .await
        .unwrap();

    let bs = bs_repo.create("Bookshelf", "icon").await.unwrap();
    bs_repo.add_book_to_bookshelf(bs.id, book_id).await.unwrap();

    repository
        .update_reading_progress(&ReadingState {
            book_id,
            last_read_page_index: 10,
            last_opened_at: Some(chrono::Utc::now().naive_utc()),
        })
        .await
        .unwrap();

    repository.delete_book(book_id).await.unwrap();

    let book = repository.get_by_id(book_id).await.unwrap();
    assert!(book.is_none());

    let tags = tag_repo.get_tags_for_book(book_id).await.unwrap();
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
