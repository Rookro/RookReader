import { z } from "zod";

/**
 * Represents a saved reading position (bookmark) within a book.
 */
export const BookmarkSchema = z.object({
  /** The unique identifier for the bookmark. */
  id: z.number(),
  /** The identifier of the book this bookmark belongs to. */
  book_id: z.number(),
  /** The display name of the bookmark. */
  name: z.string(),
  /** The bookmarked page index: the comic page, or the EPUB spine section index. */
  page_index: z.number(),
  /** The bookmarked position within an EPUB section (CFI). Null for comics. */
  cfi: z.string().nullable(),
  /**
   * The timestamp when the bookmark was created.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  created_at: z.string(),
});

/**
 * Represents a saved reading position (bookmark) within a book.
 */
export type Bookmark = z.infer<typeof BookmarkSchema>;
