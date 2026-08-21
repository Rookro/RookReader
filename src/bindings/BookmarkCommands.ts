import { commands } from "./bindings";
import { runCommand } from "./result";

/**
 * Creates a bookmark for a book.
 *
 * @param args - The bookmark to create.
 * @param args.bookId - The identifier of the book to bookmark.
 * @param args.name - The display name of the new bookmark.
 * @param args.pageIndex - The comic page index, or the EPUB spine section index.
 * @param args.cfi - The position within an EPUB section, or null for comics.
 * @returns A promise that resolves to the newly created Bookmark object.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createBookmark(args: {
  bookId: number;
  name: string;
  pageIndex: number;
  cfi: string | null;
}) {
  return await runCommand(
    commands.createBookmark(args.bookId, args.name, args.pageIndex, args.cfi),
  );
}

/**
 * Retrieves all bookmarks of a book, ordered by their position in the book.
 *
 * @param bookId - The unique identifier of the book.
 * @returns A promise that resolves to an array of Bookmark objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBookmarksByBookId(bookId: number) {
  return await runCommand(commands.getBookmarksByBookId(bookId));
}

/**
 * Renames an existing bookmark.
 *
 * @param id - The unique identifier of the bookmark to rename.
 * @param name - The new display name.
 * @returns A promise that resolves when the bookmark is successfully renamed.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function renameBookmark(id: number, name: string): Promise<void> {
  // Throws on error; the unwrapped `null` payload is intentionally ignored.
  await runCommand(commands.renameBookmark(id, name));
}

/**
 * Deletes a bookmark from the database.
 *
 * @param id - The unique identifier of the bookmark to delete.
 * @returns A promise that resolves when the bookmark is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteBookmark(id: number): Promise<void> {
  // Throws on error; the unwrapped `null` payload is intentionally ignored.
  await runCommand(commands.deleteBookmark(id));
}
