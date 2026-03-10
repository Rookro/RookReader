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
