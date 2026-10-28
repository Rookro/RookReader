import type { Bookshelf } from "../domain/entities";
import { commands } from "./bindings";
import { runCommand } from "./result";

/**
 * Creates a new bookshelf.
 *
 * @param name - The name of the new bookshelf.
 * @param iconId - The string identifier for the UI icon.
 * @returns A promise resolving to the complete newly created Bookshelf object.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createBookshelf(name: string, iconId: string): Promise<Bookshelf> {
  return await runCommand(commands.createCollection(name, iconId));
}

/**
 * Retrieves all bookshelves from the database.
 *
 * @returns A promise that resolves to an array of Bookshelf objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllBookshelves(): Promise<Bookshelf[]> {
  return await runCommand(commands.getAllCollections());
}

/**
 * Adds a book to a specific bookshelf.
 *
 * @param bookshelfId - The unique identifier of the bookshelf.
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the book is successfully added to the bookshelf.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function addBookToBookshelf(bookshelfId: number, bookId: number): Promise<void> {
  await runCommand(commands.addBookToCollection(bookshelfId, bookId));
}

/**
 * Removes a book from a specific bookshelf.
 *
 * @param bookshelfId - The unique identifier of the bookshelf.
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the book is successfully removed from the bookshelf.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function removeBookFromBookshelf(bookshelfId: number, bookId: number): Promise<void> {
  await runCommand(commands.removeBookFromCollection(bookshelfId, bookId));
}

/**
 * Retrieves the IDs of the bookshelves that contain a book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves to an array of bookshelf IDs.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookshelvesForBook(bookId: number): Promise<number[]> {
  return await runCommand(commands.getCollectionsForBook(bookId));
}

/**
 * Replaces the bookshelves that contain a book with the given ones.
 *
 * @param bookId - The unique identifier of the book.
 * @param bookshelfIds - The IDs of the bookshelves that should contain the book.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function setBookshelvesForBook(bookId: number, bookshelfIds: number[]): Promise<void> {
  await runCommand(commands.setCollectionsForBook(bookId, bookshelfIds));
}

/**
 * Deletes a bookshelf from the database.
 *
 * @param id - The unique identifier of the bookshelf to delete.
 * @returns A promise that resolves when the bookshelf is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteBookshelf(id: number): Promise<void> {
  await runCommand(commands.deleteCollection(id));
}
