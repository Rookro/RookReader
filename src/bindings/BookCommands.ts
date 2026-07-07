import type { Book, BookWithState, ReadBook, ReadingState } from "../domain/book/schema";
import { commands } from "./bindings";
import { runCommand } from "./result";

// The hand-written domain types (e.g. `Book.item_type` narrowed to "file" | "directory") are kept as
// the frontend-facing contract; the generated types are wider (Rust `String`). The `as` casts below
// bridge that intentional narrowing — the runtime shapes are identical.

/**
 * Retrieves a book by its database ID.
 *
 * @param id - The unique identifier of the book.
 * @returns A promise that resolves to the Book object if found, or null otherwise.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBook(id: number): Promise<Book | null> {
  return (await runCommand(commands.getBook(id))) as Book | null;
}

/**
 * Deletes a book from the database by its ID.
 *
 * @param id - The unique identifier of the book to delete.
 * @returns A promise that resolves when the deletion is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteBook(id: number): Promise<void> {
  await runCommand(commands.deleteBook(id));
}

/**
 * Retrieves a book by its file path.
 *
 * @param file_path - The absolute path of the book file or directory.
 * @returns A promise that resolves to the Book object if found, or null otherwise.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookByPath(file_path: string): Promise<Book | null> {
  return (await runCommand(commands.getBookByPath(file_path))) as Book | null;
}

/**
 * Retrieves a book along with its reading state by its ID.
 *
 * @param id - The unique identifier of the book.
 * @returns A promise that resolves to the BookWithState object if found, or null otherwise.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookWithStateById(id: number): Promise<BookWithState | null> {
  return (await runCommand(commands.getBookWithStateById(id))) as BookWithState | null;
}

/**
 * Retrieves all books along with their reading states from the database.
 *
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllBooksWithState(): Promise<BookWithState[]> {
  return (await runCommand(commands.getAllBooksWithState())) as BookWithState[];
}

/**
 * Registers a book or returns its ID if it already exists.
 *
 * @param params - The parameters for registering the book.
 * @param params.filePath - The absolute path of the book file or directory.
 * @param params.itemType - The type of the item ("file" or "directory").
 * @param params.displayName - The display name of the book.
 * @param params.totalPages - The total number of pages in the book.
 * @returns A promise that resolves to the ID of the registered book.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function registerBook(params: {
  filePath: string;
  itemType: "file" | "directory";
  displayName: string;
  totalPages: number;
}) {
  return await runCommand(
    commands.registerBook(params.filePath, params.itemType, params.displayName, params.totalPages),
  );
}

/**
 * Records the event of a book being opened, or updates its last opened time.
 *
 * @param params - The parameters for the book being opened.
 * @param params.filePath - The absolute path of the book file or directory.
 * @param params.itemType - The type of the item ("file" or "directory").
 * @param params.displayName - The display name of the book.
 * @param params.totalPages - The total number of pages in the book.
 * @returns A promise that resolves to the ID of the book.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function recordBookOpened(params: {
  filePath: string;
  itemType: "file" | "directory";
  displayName: string;
  totalPages: number;
}) {
  return await runCommand(
    commands.recordBookOpened(
      params.filePath,
      params.itemType,
      params.displayName,
      params.totalPages,
    ),
  );
}

/**
 * Retrieves the list of tag IDs associated with a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves to an array of tag IDs.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookTags(bookId: number) {
  return await runCommand(commands.getBookTags(bookId));
}

/**
 * Updates the tags associated with a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @param tagIds - An array of tag IDs to associate with the book.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function updateBookTags(bookId: number, tagIds: number[]): Promise<void> {
  await runCommand(commands.updateBookTags(bookId, tagIds));
}

/**
 * Updates the series associated with a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @param seriesId - The unique identifier of the series to associate with the book, or null to remove.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function updateBookSeries(bookId: number, seriesId: number | null): Promise<void> {
  await runCommand(commands.updateBookSeries(bookId, seriesId));
}

/**
 * Updates the order of books within a series.
 *
 * @param bookIds - An array of book IDs representing the new order.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function updateSeriesOrders(bookIds: number[]): Promise<void> {
  await runCommand(commands.updateSeriesOrders(bookIds));
}

/**
 * Updates the reading progress/state of a book.
 *
 * @param stateData - The reading state data to update.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function updateReadingProgress(stateData: ReadingState): Promise<void> {
  await runCommand(commands.updateReadingProgress(stateData));
}

/**
 * Clears the reading history for a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the history is cleared.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function clearReadingHistory(bookId: number): Promise<void> {
  await runCommand(commands.clearReadingHistory(bookId));
}

/**
 * Clears all reading history from the database.
 *
 * @returns A promise that resolves when all history is cleared.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function clearAllReadingHistory(): Promise<void> {
  await runCommand(commands.clearAllReadingHistory());
}

/**
 * Retrieves a list of recently read books.
 *
 * @returns A promise that resolves to an array of ReadBook objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getRecentlyReadBooks(): Promise<ReadBook[]> {
  // `limit` is an `Option<i64>` on the backend; `null` requests the default limit.
  return (await runCommand(commands.getRecentlyReadBooks(null))) as ReadBook[];
}

/**
 * Retrieves all books along with their reading states that belong to a specific bookshelf.
 *
 * @param bookshelfId - The unique identifier of the bookshelf.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksWithStateByBookshelfId(
  bookshelfId: number,
): Promise<BookWithState[]> {
  return (await runCommand(
    commands.getBooksWithStateByBookshelfId(bookshelfId),
  )) as BookWithState[];
}

/**
 * Retrieves all books along with their reading states that are associated with a specific tag.
 *
 * @param tagId - The unique identifier of the tag.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksWithStateByTagId(tagId: number): Promise<BookWithState[]> {
  return (await runCommand(commands.getBooksWithStateByTagId(tagId))) as BookWithState[];
}

/**
 * Retrieves all books along with their reading states that belong to a specific series.
 *
 * @param seriesId - The unique identifier of the series.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksWithStateBySeriesId(seriesId: number): Promise<BookWithState[]> {
  return (await runCommand(commands.getBooksWithStateBySeriesId(seriesId))) as BookWithState[];
}
