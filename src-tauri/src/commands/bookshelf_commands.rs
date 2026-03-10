use std::sync::Arc;
use tauri::State;

use crate::database::bookshelf::{Bookshelf, BookshelfRepository};
use crate::error::Result;

/// Creates a new bookshelf and returns its complete entity.
///
/// # Arguments
///
/// * `name` - The name of the new bookshelf.
/// * `icon_id` - The string identifier for the UI icon.
/// * `repo` - The managed bookshelf repository state.
///
/// # Returns
///
/// A `Result` containing the newly created `Bookshelf` entity.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn create_bookshelf(
    name: String,
    icon_id: String,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<Bookshelf> {
    log::debug!("Create bookshelf. (name:{}, icon_id:{})", name, icon_id);
    Ok(repo.create(&name, &icon_id).await?)
}

/// Retrieves all bookshelves from the database.
///
/// # Arguments
///
/// * `repo` - The managed bookshelf repository state.
///
/// # Returns
///
/// A `Result` containing a vector of `Bookshelf` entities.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn get_all_bookshelves(
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<Vec<Bookshelf>> {
    log::debug!("Get all bookshelves");
    Ok(repo.get_all().await?)
}

/// Adds a book to a specific bookshelf.
///
/// # Arguments
///
/// * `bookshelf_id` - The ID of the bookshelf.
/// * `book_id` - The ID of the book to add.
/// * `repo` - The managed bookshelf repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails
/// (e.g., due to a database error, connection issue, or query execution failure).
#[tauri::command]
pub async fn add_book_to_bookshelf(
    bookshelf_id: i64,
    book_id: i64,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<()> {
    log::debug!(
        "Add book to bookshelf. (bookshelf_id:{}, book_id:{})",
        bookshelf_id,
        book_id
    );
    Ok(repo.add_book_to_bookshelf(bookshelf_id, book_id).await?)
}

/// Removes a book from a specific bookshelf.
///
/// # Arguments
///
/// * `bookshelf_id` - The ID of the bookshelf.
/// * `book_id` - The ID of the book to remove.
/// * `repo` - The managed bookshelf repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn remove_book_from_bookshelf(
    bookshelf_id: i64,
    book_id: i64,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<()> {
    log::debug!(
        "Remove book from bookshelf. (bookshelf_id:{}, book_id:{})",
        bookshelf_id,
        book_id
    );
    Ok(repo
        .remove_book_from_bookshelf(bookshelf_id, book_id)
        .await?)
}

/// Deletes a bookshelf from the database.
///
/// # Arguments
///
/// * `id` - The ID of the bookshelf to delete.
/// * `repo` - The managed bookshelf repository state.
///
/// # Errors
///
/// This function will return an `Err` if the underlying repository operation fails.
#[tauri::command]
pub async fn delete_bookshelf(
    id: i64,
    repo: State<'_, Arc<dyn BookshelfRepository>>,
) -> Result<()> {
    log::debug!("Delete bookshelf. (id:{})", id);
    Ok(repo.delete(id).await?)
}
