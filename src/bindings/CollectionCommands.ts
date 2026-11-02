import type { BookWithState, Collection } from "../domain/entities";
import { commands } from "./bindings";
import { runCommand } from "./result";

/**
 * Creates a new collection.
 *
 * @param name - The name of the new collection.
 * @param iconId - The string identifier for the UI icon.
 * @returns A promise resolving to the complete newly created Collection object.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createCollection(name: string, iconId: string): Promise<Collection> {
  return await runCommand(commands.createCollection(name, iconId));
}

/**
 * Retrieves all collections from the database.
 *
 * @returns A promise that resolves to an array of Collection objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllCollections(): Promise<Collection[]> {
  return await runCommand(commands.getAllCollections());
}

/**
 * Adds a book to a specific collection.
 *
 * @param collectionId - The unique identifier of the collection.
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the book is successfully added to the collection.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function addBookToCollection(collectionId: number, bookId: number): Promise<void> {
  await runCommand(commands.addBookToCollection(collectionId, bookId));
}

/**
 * Removes a book from a specific collection.
 *
 * @param collectionId - The unique identifier of the collection.
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the book is successfully removed from the collection.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function removeBookFromCollection(
  collectionId: number,
  bookId: number,
): Promise<void> {
  await runCommand(commands.removeBookFromCollection(collectionId, bookId));
}

/**
 * Retrieves the IDs of the collections that contain a book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves to an array of collection IDs.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getCollectionsForBook(bookId: number): Promise<number[]> {
  return await runCommand(commands.getCollectionsForBook(bookId));
}

/**
 * Replaces the collections that contain a book with the given ones.
 *
 * @param bookId - The unique identifier of the book.
 * @param collectionIds - The IDs of the collections that should contain the book.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function setCollectionsForBook(
  bookId: number,
  collectionIds: number[],
): Promise<void> {
  await runCommand(commands.setCollectionsForBook(bookId, collectionIds));
}

/**
 * Deletes a collection from the database.
 *
 * @param id - The unique identifier of the collection to delete.
 * @returns A promise that resolves when the collection is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteCollection(id: number): Promise<void> {
  await runCommand(commands.deleteCollection(id));
}

/**
 * Retrieves all books along with their reading states that belong to a specific collection.
 *
 * @param collectionId - The unique identifier of the collection.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksByCollection(collectionId: number): Promise<BookWithState[]> {
  return await runCommand(commands.getBooksByCollection(collectionId));
}
