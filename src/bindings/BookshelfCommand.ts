import { invoke } from "@tauri-apps/api/core";
import type { Bookshelf } from "../types/DatabaseModels";
import { createCommandError } from "../types/Error";

/**
 * Creates a new bookshelf.
 *
 * @param name - The name of the new bookshelf.
 * @param iconId - The string identifier for the UI icon.
 * @returns A promise resolving to the complete newly created Bookshelf object.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createBookshelf(name: string, iconId: string) {
  try {
    return await invoke<Bookshelf>("create_bookshelf", { name, iconId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all bookshelves from the database.
 *
 * @returns A promise that resolves to an array of Bookshelf objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllBookshelves() {
  try {
    return await invoke<Bookshelf[]>("get_all_bookshelves");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Adds a book to a specific bookshelf.
 *
 * @param bookshelfId - The unique identifier of the bookshelf.
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the book is successfully added to the bookshelf.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function addBookToBookshelf(bookshelfId: number, bookId: number) {
  try {
    return await invoke<void>("add_book_to_bookshelf", { bookshelfId, bookId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Removes a book from a specific bookshelf.
 *
 * @param bookshelfId - The unique identifier of the bookshelf.
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the book is successfully removed from the bookshelf.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function removeBookFromBookshelf(bookshelfId: number, bookId: number) {
  try {
    return await invoke<void>("remove_book_from_bookshelf", { bookshelfId, bookId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Deletes a bookshelf from the database.
 *
 * @param id - The unique identifier of the bookshelf to delete.
 * @returns A promise that resolves when the bookshelf is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteBookshelf(id: number) {
  try {
    return await invoke<void>("delete_bookshelf", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}
