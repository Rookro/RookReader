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
