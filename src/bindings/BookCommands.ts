import { invoke } from "@tauri-apps/api/core";
import { Book, BookWithState, ReadBook, ReadingState } from "../types/DatabaseModels";
import { createCommandError } from "../types/Error";

/**
 * Retrieves a book by its database ID.
 *
 * @param id - The unique identifier of the book.
 * @returns A promise that resolves to the Book object if found, or null otherwise.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBook(id: number) {
  try {
    return await invoke<Book | null>("get_book", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Deletes a book from the database by its ID.
 *
 * @param id - The unique identifier of the book to delete.
 * @returns A promise that resolves when the deletion is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteBook(id: number) {
  try {
    return await invoke<void>("delete_book", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves a book by its file path.
 *
 * @param file_path - The absolute path of the book file or directory.
 * @returns A promise that resolves to the Book object if found, or null otherwise.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookByPath(file_path: string) {
  try {
    return await invoke<Book | null>("get_book_by_path", { file_path });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves a book along with its reading state by its ID.
 *
 * @param id - The unique identifier of the book.
 * @returns A promise that resolves to the BookWithState object if found, or null otherwise.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookWithStateById(id: number) {
  try {
    return await invoke<BookWithState | null>("get_book_with_state_by_id", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all books along with their reading states from the database.
 *
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllBooksWithState() {
  try {
    return await invoke<BookWithState[]>("get_all_books_with_state");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Inserts or updates a book in the database.
 *
 * @param params - The parameters for upserting the book.
 * @param params.filePath - The absolute path of the book file or directory.
 * @param params.itemType - The type of the item ("file" or "directory").
 * @param params.displayName - The display name of the book.
 * @param params.totalPages - The total number of pages in the book.
 * @returns A promise that resolves to the ID of the upserted book.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function upsertBook(params: {
  filePath: string;
  itemType: "file" | "directory";
  displayName: string;
  totalPages: number;
}) {
  try {
    return await invoke<number>("upsert_book", {
      filePath: params.filePath,
      itemType: params.itemType,
      displayName: params.displayName,
      totalPages: params.totalPages,
    });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Inserts or updates a book in the database and records it as recently read.
 *
 * @param params - The parameters for upserting the read book.
 * @param params.filePath - The absolute path of the book file or directory.
 * @param params.itemType - The type of the item ("file" or "directory").
 * @param params.displayName - The display name of the book.
 * @param params.totalPages - The total number of pages in the book.
 * @returns A promise that resolves to the ID of the upserted book.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function upsertReadBook(params: {
  filePath: string;
  itemType: "file" | "directory";
  displayName: string;
  totalPages: number;
}) {
  try {
    return await invoke<number>("upsert_read_book", {
      filePath: params.filePath,
      itemType: params.itemType,
      displayName: params.displayName,
      totalPages: params.totalPages,
    });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves the list of tag IDs associated with a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves to an array of tag IDs.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookTags(bookId: number) {
  try {
    return await invoke<number[]>("get_book_tags", { bookId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Updates the tags associated with a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @param tagIds - An array of tag IDs to associate with the book.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function updateBookTags(bookId: number, tagIds: number[]) {
  try {
    return await invoke<void>("update_book_tags", { bookId, tagIds });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Inserts or updates the reading state of a book.
 *
 * @param stateData - The reading state data to upsert.
 * @returns A promise that resolves when the upsert is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function upsertReadingState(stateData: ReadingState) {
  try {
    return await invoke<void>("upsert_reading_state", { stateData });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Clears the reading history for a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves when the history is cleared.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function clearReadingHistory(bookId: number) {
  try {
    return await invoke<void>("clear_reading_history", { bookId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Clears all reading history from the database.
 *
 * @returns A promise that resolves when all history is cleared.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function clearAllReadingHistory() {
  try {
    return await invoke<void>("clear_all_reading_history");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves a list of recently read books.
 *
 * @returns A promise that resolves to an array of ReadBook objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getRecentlyReadBooks() {
  try {
    return await invoke<ReadBook[]>("get_recently_read_books");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all books along with their reading states that belong to a specific bookshelf.
 *
 * @param bookshelfId - The unique identifier of the bookshelf.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksWithStateByBookshelfId(bookshelfId: number) {
  try {
    return await invoke<BookWithState[]>("get_books_with_state_by_bookshelf_id", { bookshelfId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all books along with their reading states that are associated with a specific tag.
 *
 * @param tagId - The unique identifier of the tag.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksWithStateByTagId(tagId: number) {
  try {
    return await invoke<BookWithState[]>("get_books_with_state_by_tag_id", { tagId });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all books along with their reading states that belong to a specific series.
 *
 * @param seriesId - The unique identifier of the series.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksWithStateBySeriesId(seriesId: number) {
  try {
    return await invoke<BookWithState[]>("get_books_with_state_by_series_id", { seriesId });
  } catch (error) {
    throw createCommandError(error);
  }
}
