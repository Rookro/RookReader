use std::sync::Arc;
use tauri::State;

use crate::database::history::history_repository::HistoryRepository;
use crate::database::history::models::HistoryEntry;
use crate::error::Result;

/// Inserts or updates a history entry for a given path.
///
/// If a history entry for the given path already exists, its properties will be updated.
/// If it does not exist, a new entry will be created.
///
/// # Arguments
///
/// * `path` - The file path or identifier for the history item.
/// * `item_type` - The type of the item (e.g., "file", "directory", "container").
/// * `page_index` - The optional page index the user was viewing.
/// * `repo` - A `tauri::State` holding the `HistoryRepository`.
///
/// # Returns
///
/// A `Result` indicating success (`Ok(())`) or an error (`Err`).
///
/// # Errors
///
/// This function will return an `Err` if the database operation fails.
#[tauri::command]
pub async fn upsert_history(
    path: String,
    item_type: String,
    page_index: Option<i64>,
    repo: State<'_, Arc<dyn HistoryRepository>>,
) -> Result<()> {
    log::debug!(
        "Upsert history (path:{}, item_type:{}, page_index:{:?})",
        path,
        item_type,
        page_index
    );
    repo.upsert(&path, &item_type, page_index).await
}

/// Retrieves all history entries from the database.
///
/// # Arguments
///
/// * `repo` - A `tauri::State` holding the `HistoryRepository`.
///
/// # Returns
///
/// A `Result` which is `Ok` with a `Vec<HistoryEntry>` containing all history records.
///
/// # Errors
///
/// This function will return an `Err` if the database query fails.
#[tauri::command]
pub async fn get_all_history(
    repo: State<'_, Arc<dyn HistoryRepository>>,
) -> Result<Vec<HistoryEntry>> {
    log::debug!("Get all history.");
    repo.get_all().await
}

/// Retrieves the most recently accessed history entry.
///
/// # Arguments
///
/// * `repo` - A `tauri::State` holding the `HistoryRepository`.
///
/// # Returns
///
/// A `Result` which is `Ok` with an `Option<HistoryEntry>`. It will be `Some` if an entry exists, or `None` if the history is empty.
///
/// # Errors
///
/// This function will return an `Err` if the database query fails.
#[tauri::command]
pub async fn get_latest_history(
    repo: State<'_, Arc<dyn HistoryRepository>>,
) -> Result<Option<HistoryEntry>> {
    log::debug!("Get latest history.");
    repo.get_latest().await
}

/// Retrieves a specific history entry by its path.
///
/// # Arguments
///
/// * `path` - The path of the history entry to retrieve.
/// * `repo` - A `tauri::State` holding the `HistoryRepository`.
///
/// # Returns
///
/// A `Result` which is `Ok` with an `Option<HistoryEntry>`. It will be `Some` if an entry is found for the given path, or `None` if it does not exist.
///
/// # Errors
///
/// This function will return an `Err` if the database query fails.
#[tauri::command]
pub async fn get_history(
    path: String,
    repo: State<'_, Arc<dyn HistoryRepository>>,
) -> Result<Option<HistoryEntry>> {
    log::debug!("Get history of {}.", path);
    repo.get(&path).await
}

/// Deletes a specific history entry by its ID.
///
/// # Arguments
///
/// * `id` - The unique identifier of the history entry to delete.
/// * `repo` - A `tauri::State` holding the `HistoryRepository`.
///
/// # Returns
///
/// A `Result` indicating success (`Ok(())`) or an error (`Err`).
///
/// # Errors
///
/// This function will return an `Err` if the database deletion fails.
#[tauri::command]
pub async fn delete_history(id: i64, repo: State<'_, Arc<dyn HistoryRepository>>) -> Result<()> {
    log::debug!("Delete history of {}", id);
    repo.delete(id).await
}

/// Deletes all history entries from the database.
///
/// # Arguments
///
/// * `repo` - A `tauri::State` holding the `HistoryRepository`.
///
/// # Returns
///
/// A `Result` indicating success (`Ok(())`) or an error (`Err`).
///
/// # Errors
///
/// This function will return an `Err` if the database deletion fails.
#[tauri::command]
pub async fn delete_all_history(repo: State<'_, Arc<dyn HistoryRepository>>) -> Result<()> {
    log::debug!("Delete all history");
    repo.delete_all().await
}
