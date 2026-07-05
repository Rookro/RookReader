import { z } from "zod";

/**
 * Represents a bookshelf entity used to organize books.
 */
export const BookshelfSchema = z.object({
  /** The unique identifier for the bookshelf. */
  id: z.number(),
  /** The display name of the bookshelf. */
  name: z.string(),
  /** The string identifier for the UI icon (e.g., "folder"). */
  icon_id: z.string(),
  /**
   * The timestamp when the bookshelf was created.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00"), or null.
   */
  created_at: z.string().nullable(),
});

/**
 * Represents a bookshelf entity used to organize books.
 */
export type Bookshelf = z.infer<typeof BookshelfSchema>;
