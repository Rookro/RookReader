use rookreader_lib::database::book::BookRepository;
use rookreader_lib::database::series::{SeriesRepository, SqliteSeriesRepository};

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
    assert!(matches!(err, sqlx::Error::Database(_)));
}

#[tokio::test]
async fn test_delete_series() {
    let pool = setup_db().await;
    let series_repo = SqliteSeriesRepository::new(pool.clone());
    let book_repo = rookreader_lib::database::book::SqliteBookRepository::new(pool.clone());

    let series_id = series_repo.create("Series A").await.unwrap();

    let book_id = book_repo
        .upsert_book("path/to/book.zip", "file", "Book A", 100, None)
        .await
        .unwrap();

    book_repo
        .update_book_series(book_id, Some(series_id))
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
