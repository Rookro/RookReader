use rookreader_lib::domain::book::repository::BookRepository;
use rookreader_lib::domain::series::repository::SeriesRepository;
use rookreader_lib::error::Error;
use rookreader_lib::infrastructure::database::book_repository::SqliteBookRepository;
use rookreader_lib::infrastructure::database::series_repository::SqliteSeriesRepository;

mod common;
use common::setup_db;

#[tokio::test]
async fn test_create_and_get_all_series() {
    let pool = setup_db().await;
    let repository = SqliteSeriesRepository::new(pool.clone());

    let id1 = repository.create("Series A").await.unwrap();
    let id2 = repository.create("Series B").await.unwrap();

    let series = repository.get_all().await.unwrap();
    assert_eq!(series.len(), 2);

    assert_eq!(series[0].id, id1);
    assert_eq!(series[0].name, "Series A");

    assert_eq!(series[1].id, id2);
    assert_eq!(series[1].name, "Series B");
}

#[tokio::test]
async fn test_create_duplicate_series() {
    let pool = setup_db().await;
    let repository = SqliteSeriesRepository::new(pool.clone());

    repository.create("Series A").await.unwrap();
    let err = repository.create("Series A").await.unwrap_err();

    // Error should be a database constraint error due to UNIQUE constraint
    assert!(matches!(err, Error::Database(sqlx::Error::Database(_))));
}

#[tokio::test]
async fn test_assign_book_to_series() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = SqliteBookRepository::new(pool.clone());

    let series_id = series_repo.create("Series X").await.unwrap();
    let book_id = book_repo
        .register_book("path/x", "file", "Book X", 100, None)
        .await
        .unwrap();

    // Assign
    series_repo
        .assign_book_to_series(book_id, Some(series_id))
        .await
        .unwrap();
    let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.series_id, Some(series_id));

    // Remove (assign None)
    series_repo
        .assign_book_to_series(book_id, None)
        .await
        .unwrap();
    let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.series_id, None);
}

#[tokio::test]
async fn test_delete_series() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = SqliteBookRepository::new(pool.clone());

    let series_id = series_repo.create("Series A").await.unwrap();

    let book_id = book_repo
        .register_book("path/to/book.zip", "file", "Book A", 100, None)
        .await
        .unwrap();

    series_repo
        .assign_book_to_series(book_id, Some(series_id))
        .await
        .unwrap();

    // Verify book has series_id
    let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.series_id, Some(series_id));

    // Delete series
    series_repo.delete(series_id).await.unwrap();

    // Verify series is gone
    let series = series_repo.get_all().await.unwrap();
    assert_eq!(series.len(), 0);

    // Verify book's series_id is now None
    let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.series_id, None);
}

#[tokio::test]
async fn test_update_book_orders_in_series() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = SqliteBookRepository::new(pool.clone());

    let series_id = series_repo.create("Ordered Series").await.unwrap();

    let b1 = book_repo
        .register_book("path/1", "file", "Book 1", 100, None)
        .await
        .unwrap();
    let b2 = book_repo
        .register_book("path/2", "file", "Book 2", 100, None)
        .await
        .unwrap();
    let b3 = book_repo
        .register_book("path/3", "file", "Book 3", 100, None)
        .await
        .unwrap();

    // Assign to series
    series_repo
        .assign_book_to_series(b1, Some(series_id))
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(b2, Some(series_id))
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(b3, Some(series_id))
        .await
        .unwrap();

    // Initial order doesn't matter much for this test, let's set a specific one
    series_repo
        .update_book_orders_in_series(vec![b3, b1, b2])
        .await
        .unwrap();

    // Verify order
    let book3 = book_repo.get_by_id(b3).await.unwrap().unwrap();
    let book1 = book_repo.get_by_id(b1).await.unwrap().unwrap();
    let book2 = book_repo.get_by_id(b2).await.unwrap().unwrap();

    assert_eq!(book3.series_order, Some(1));
    assert_eq!(book1.series_order, Some(2));
    assert_eq!(book2.series_order, Some(3));
}

#[tokio::test]
async fn test_assign_appends_at_end_of_series() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = SqliteBookRepository::new(pool.clone());

    let series_id = series_repo.create("Series").await.unwrap();
    let b1 = book_repo
        .register_book("path/1", "file", "Book 1", 100, None)
        .await
        .unwrap();
    let b2 = book_repo
        .register_book("path/2", "file", "Book 2", 100, None)
        .await
        .unwrap();

    series_repo
        .assign_book_to_series(b1, Some(series_id))
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(b2, Some(series_id))
        .await
        .unwrap();

    // Each newly assigned book gets MAX(series_order) + 1 within the target series.
    let book1 = book_repo.get_by_id(b1).await.unwrap().unwrap();
    let book2 = book_repo.get_by_id(b2).await.unwrap().unwrap();
    assert_eq!(book1.series_order, Some(1));
    assert_eq!(book2.series_order, Some(2));
}

#[tokio::test]
async fn test_unassign_clears_series_order() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = SqliteBookRepository::new(pool.clone());

    let series_id = series_repo.create("Series").await.unwrap();
    let book_id = book_repo
        .register_book("path/x", "file", "Book X", 100, None)
        .await
        .unwrap();

    series_repo
        .assign_book_to_series(book_id, Some(series_id))
        .await
        .unwrap();
    let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.series_order, Some(1));

    // Clearing the series also clears the order so it cannot resurface later.
    series_repo
        .assign_book_to_series(book_id, None)
        .await
        .unwrap();
    let book = book_repo.get_by_id(book_id).await.unwrap().unwrap();
    assert_eq!(book.series_id, None);
    assert_eq!(book.series_order, None);
}

#[tokio::test]
async fn test_move_book_between_series_has_no_order_collision() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = SqliteBookRepository::new(pool.clone());

    let series_a = series_repo.create("Series A").await.unwrap();
    let series_b = series_repo.create("Series B").await.unwrap();

    // Series B already has two ordered books.
    let p = book_repo
        .register_book("path/p", "file", "Book P", 100, None)
        .await
        .unwrap();
    let q = book_repo
        .register_book("path/q", "file", "Book Q", 100, None)
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(p, Some(series_b))
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(q, Some(series_b))
        .await
        .unwrap();

    // A book that starts in Series A (with a stale order) is moved into Series B.
    let x = book_repo
        .register_book("path/x", "file", "Book X", 100, None)
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(x, Some(series_a))
        .await
        .unwrap();
    series_repo
        .assign_book_to_series(x, Some(series_b))
        .await
        .unwrap();

    // X lands at the end of Series B without colliding with P/Q's orders.
    let book_p = book_repo.get_by_id(p).await.unwrap().unwrap();
    let book_q = book_repo.get_by_id(q).await.unwrap().unwrap();
    let book_x = book_repo.get_by_id(x).await.unwrap().unwrap();
    assert_eq!(book_p.series_order, Some(1));
    assert_eq!(book_q.series_order, Some(2));
    assert_eq!(book_x.series_order, Some(3));
}
