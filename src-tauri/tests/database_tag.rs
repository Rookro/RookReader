use rookreader_lib::database::tag::{SqliteTagRepository, TagRepository};

mod common;
use common::setup_db;

#[tokio::test]
async fn test_create_and_get_all_tags() {
    let pool = setup_db().await;
    let repository = SqliteTagRepository::new(pool.clone());

    let t1 = repository.create("Action", "#ff0000").await.unwrap();
    assert_eq!(t1.name, "Action");
    assert_eq!(t1.color_code, "#ff0000");

    let t2 = repository.create("Comedy", "#00ff00").await.unwrap();
    assert_eq!(t2.name, "Comedy");
    assert_eq!(t2.color_code, "#00ff00");

    let tags = repository.get_all().await.unwrap();
    assert_eq!(tags.len(), 2);
    assert_eq!(tags[0].name, "Action");
    assert_eq!(tags[1].name, "Comedy");
}

#[tokio::test]
async fn test_create_duplicate_tag() {
    let pool = setup_db().await;
    let repository = SqliteTagRepository::new(pool.clone());

    repository.create("Action", "#ff0000").await.unwrap();
    let err = repository.create("Action", "#0000ff").await.unwrap_err();

    // Error should be a database constraint error due to UNIQUE constraint
    assert!(matches!(err, sqlx::Error::Database(_)));
}

#[tokio::test]
async fn test_delete_tag() {
    let pool = setup_db().await;
    let repository = SqliteTagRepository::new(pool.clone());

    let t1 = repository.create("Action", "#ff0000").await.unwrap();
    repository.create("Comedy", "#00ff00").await.unwrap();

    repository.delete(t1.id).await.unwrap();

    let tags = repository.get_all().await.unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "Comedy");
}
