import { z } from "zod";

/**
 * Represents a book entity.
 */
export const BookSchema = z.object({
  /** The unique identifier for the book. */
  id: z.number(),
  /** The unique file path or directory path of the book. */
  file_path: z.string(),
  /** The type of the item. */
  item_type: z.enum(["file", "directory"]),
  /** The display name of the book. */
  display_name: z.string(),
  /** The total number of pages in the book. */
  total_pages: z.number(),
  /** The optional identifier of the series this book belongs to. */
  series_id: z.number().nullable(),
  /** The optional order index of the book within its series. */
  series_order: z.number().nullable(),
  /** The optional file path to the thumbnail image of the book. */
  thumbnail_path: z.string().nullable(),
});

/**
 * Represents the reading state of a specific book.
 */
export const ReadingStateSchema = z.object({
  /** The unique identifier for the associated book. */
  book_id: z.number(),
  /** The last read page index. */
  last_read_page_index: z.number(),
  /**
   * The timestamp when the book was last opened.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  last_opened_at: z.string(),
});

/**
 * Represents a book along with its reading state, specifically for books that have been opened.
 */
export const ReadBookSchema = BookSchema.extend({
  /** The last read page index. */
  last_read_page_index: z.number(),
  /**
   * The timestamp when the book was last opened.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  last_opened_at: z.string(),
});

/**
 * Represents a book along with its optional reading state.
 */
export const BookWithStateSchema = BookSchema.extend({
  /** The last read page index, if the book has been opened. */
  last_read_page_index: z.number().nullable(),
  /**
   * The timestamp when the book was last opened.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  last_opened_at: z.string().nullable(),
  /** List of tag IDs associated with this book. */
  tag_ids: z.array(z.number()),
});

/**
 * Represents a book entity.
 */
export type Book = z.infer<typeof BookSchema>;

/**
 * Represents the reading state of a specific book.
 */
export type ReadingState = z.infer<typeof ReadingStateSchema>;

/**
 * Represents a book along with its reading state, specifically for books that have been opened.
 */
export type ReadBook = z.infer<typeof ReadBookSchema>;

/**
 * Represents a book along with its optional reading state.
 */
export type BookWithState = z.infer<typeof BookWithStateSchema>;
