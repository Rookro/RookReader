use std::sync::Arc;
use tauri::State;

use crate::database::series::{Series, SeriesRepository};
use crate::error::Result;

/// Creates a new series.
///
/// # Arguments
///
/// * `name` - The name of the new series.
/// * `repo` - The managed series repository state.
///
/// # Returns
///
/// A `Result` containing the ID of the newly created series.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn create_series(
    name: String,
    repo: State<'_, Arc<dyn SeriesRepository>>,
) -> Result<i64> {
    log::debug!("Create series. (name:{})", name);
    Ok(repo.create(&name).await?)
}

/// Retrieves all series from the database.
///
/// # Arguments
///
/// * `repo` - The managed series repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Series` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn get_all_series(repo: State<'_, Arc<dyn SeriesRepository>>) -> Result<Vec<Series>> {
    log::debug!("Get all series.");
    Ok(repo.get_all().await?)
}

/// Deletes a series by its ID.
///
/// # Arguments
///
/// * `id` - The ID of the series to delete.
/// * `repo` - The managed series repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn delete_series(id: i64, repo: State<'_, Arc<dyn SeriesRepository>>) -> Result<()> {
    log::debug!("Delete series. (id:{})", id);
    Ok(repo.delete(id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::series::MockSeriesRepository;
    use crate::error::ErrorCode;
    use tauri::Manager;

    #[tokio::test]
    async fn test_create_series() {
        let mut mock_repo = MockSeriesRepository::new();
        mock_repo
            .expect_create()
            .with(mockall::predicate::eq("New Series"))
            .times(1)
            .returning(|_| Ok(1));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let state = app.state::<Arc<dyn SeriesRepository>>();

        let result = create_series("New Series".to_string(), state).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_get_all_series() {
        let mut mock_repo = MockSeriesRepository::new();
        let now = chrono::Utc::now().naive_utc();
        mock_repo.expect_get_all().times(1).returning(move || {
            Ok(vec![
                Series {
                    id: 1,
                    name: "Series 1".to_string(),
                    created_at: now,
                },
                Series {
                    id: 2,
                    name: "Series 2".to_string(),
                    created_at: now,
                },
            ])
        });

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let state = app.state::<Arc<dyn SeriesRepository>>();

        let result = get_all_series(state).await;
        assert!(result.is_ok());
        let series = result.unwrap();
        assert_eq!(series.len(), 2);
        assert_eq!(series[0].id, 1);
        assert_eq!(series[0].name, "Series 1");
        assert_eq!(series[0].created_at, now);
        assert_eq!(series[1].id, 2);
        assert_eq!(series[1].name, "Series 2");
        assert_eq!(series[1].created_at, now);
    }

    #[tokio::test]
    async fn test_delete_series() {
        let mut mock_repo = MockSeriesRepository::new();
        mock_repo
            .expect_delete()
            .with(mockall::predicate::eq(1))
            .times(1)
            .returning(|_| Ok(()));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let state = app.state::<Arc<dyn SeriesRepository>>();

        let result = delete_series(1, state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_create_series_error() {
        let mut mock_repo = MockSeriesRepository::new();
        mock_repo
            .expect_create()
            .returning(|_| Err(sqlx::Error::RowNotFound));

        let app = tauri::test::mock_app();
        app.manage(Arc::new(mock_repo) as Arc<dyn SeriesRepository>);
        let state = app.state::<Arc<dyn SeriesRepository>>();

        let result = create_series("Fail".to_string(), state).await;
        assert!(result.is_err());
        if let Err(e) = result {
            let error_code: ErrorCode = (&e).into();
            assert_eq!(error_code.code(), 70001);
        }
    }
}
