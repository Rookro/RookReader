import type { Bookshelf } from "../domain/bookshelf/schema";
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
  return (await runCommand(commands.createBookshelf(name, iconId))) as Bookshelf;
}

/**
 * Retrieves all bookshelves from the database.
 *
 * @returns A promise that resolves to an array of Bookshelf objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllBookshelves(): Promise<Bookshelf[]> {
  return (await runCommand(commands.getAllBookshelves())) as Bookshelf[];
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
  await runCommand(commands.addBookToBookshelf(bookshelfId, bookId));
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
  await runCommand(commands.removeBookFromBookshelf(bookshelfId, bookId));
}

/**
 * Deletes a bookshelf from the database.
 *
 * @param id - The unique identifier of the bookshelf to delete.
 * @returns A promise that resolves when the bookshelf is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteBookshelf(id: number): Promise<void> {
  await runCommand(commands.deleteBookshelf(id));
}
