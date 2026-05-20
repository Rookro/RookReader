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
        .upsert_book("path/x", "file", "Book X", 100, None)
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
        .upsert_book("path/to/book.zip", "file", "Book A", 100, None)
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
        .upsert_book("path/1", "file", "Book 1", 100, None)
        .await
        .unwrap();
    let b2 = book_repo
        .upsert_book("path/2", "file", "Book 2", 100, None)
        .await
        .unwrap();
    let b3 = book_repo
        .upsert_book("path/3", "file", "Book 3", 100, None)
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
