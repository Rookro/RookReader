use std::sync::Arc;
use tauri::State;

use crate::database::tag::{Tag, TagRepository};
use crate::error::Result;

/// Creates a new tag and returns its complete entity.
///
/// # Arguments
///
/// * `name` - The name of the new tag.
/// * `color_code` - The color code for the tag.
/// * `repo` - The managed tag repository state.
///
/// # Returns
///
/// A `Result` containing the newly created `Tag` entity.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn create_tag(
    name: String,
    color_code: String,
    repo: State<'_, Arc<dyn TagRepository>>,
) -> Result<Tag> {
    log::debug!("Create tag. (name:{}, color_code:{})", name, color_code);
    Ok(repo.create(&name, &color_code).await?)
}

/// Retrieves all tags from the database.
///
/// # Arguments
///
/// * `repo` - The managed tag repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Tag` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn get_all_tags(repo: State<'_, Arc<dyn TagRepository>>) -> Result<Vec<Tag>> {
    log::debug!("Get all tags.");
    Ok(repo.get_all().await?)
}

/// Deletes a tag from the database.
///
/// # Arguments
///
/// * `id` - The ID of the tag to delete.
/// * `repo` - The managed tag repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn delete_tag(id: i64, repo: State<'_, Arc<dyn TagRepository>>) -> Result<()> {
    log::debug!("Delete tag. (id:{})", id);
    Ok(repo.delete(id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::tag::MockTagRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;

    #[tokio::test]
    async fn test_create_tag() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_create()
            .with(
                mockall::predicate::eq("tag1"),
                mockall::predicate::eq("#FF0000"),
            )
            .times(1)
            .returning(|name, color| {
                Ok(Tag {
                    id: 1,
                    name: name.to_string(),
                    color_code: color.to_string(),
                })
            });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = create_tag("tag1".to_string(), "#FF0000".to_string(), state).await;
        assert!(result.is_ok());
        let tag = result.unwrap();
        assert_eq!(tag.id, 1);
        assert_eq!(tag.name, "tag1");
        assert_eq!(tag.color_code, "#FF0000");
    }

    #[tokio::test]
    async fn test_get_all_tags() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo.expect_get_all().times(1).returning(|| {
            Ok(vec![
                Tag {
                    id: 1,
                    name: "tag1".to_string(),
                    color_code: "#FF0000".to_string(),
                },
                Tag {
                    id: 2,
                    name: "tag2".to_string(),
                    color_code: "#00FF00".to_string(),
                },
            ])
        });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = get_all_tags(state).await;
        assert!(result.is_ok());
        let tags = result.unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "tag1");
    }

    #[tokio::test]
    async fn test_delete_tag() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = delete_tag(1, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_tag_error() {
        let mut mock_repo = MockTagRepository::new();
        mock_repo
            .expect_create()
            .returning(|_, _| Err(sqlx::Error::RowNotFound));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn TagRepository>);
        let state = app.state::<Arc<dyn TagRepository>>();

        let result = create_tag("fail".to_string(), "fail".to_string(), state).await;
        assert!(result.is_err());
        let e = result.unwrap_err();
        let error_code: ErrorCode = (&e).into();
        assert_eq!(error_code.code(), 70001);
    }
}
