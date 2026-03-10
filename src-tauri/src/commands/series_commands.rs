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
