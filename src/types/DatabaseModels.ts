/**
 * Represents a book entity in the database.
 */
export interface Book {
  /** The unique identifier for the book. */
  id: number;
  /** The unique file path or directory path of the book. */
  file_path: string;
  /** The type of the item. */
  item_type: "file" | "directory";
  /** The display name of the book. */
  display_name: string;
  /** The total number of pages in the book. */
  total_pages: number;
  /** The optional identifier of the series this book belongs to. */
  series_id: number | null;
  /** The optional order index of the book within its series. */
  series_order: number | null;
  /** The optional file path to the thumbnail image of the book. */
  thumbnail_path: string | null;
}

/**
 * Represents the reading state of a specific book.
 */
export interface ReadingState {
  /** The unique identifier for the associated book. */
  book_id: number;
  /** The last read page index. */
  last_read_page_index: number;
  /**
   * The timestamp when the book was last opened.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  last_opened_at: string;
}

/**
 * Represents a book along with its reading state, specifically for books that have been opened.
 */
export interface ReadBook {
  /** The unique identifier for the book. */
  id: number;
  /** The unique file path or directory path of the book. */
  file_path: string;
  /** The type of the item. */
  item_type: "file" | "directory";
  /** The display name of the book. */
  display_name: string;
  /** The total number of pages in the book. */
  total_pages: number;
  /** The optional identifier of the series this book belongs to. */
  series_id: number | null;
  /** The optional order index of the book within its series. */
  series_order: number | null;
  /** The optional file path to the thumbnail image of the book. */
  thumbnail_path: string | null;
  /** The last read page index. */
  last_read_page_index: number;
  /**
   * The timestamp when the book was last opened.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  last_opened_at: string;
}

/**
 * Represents a book along with its optional reading state.
 */
export interface BookWithState {
  /** The unique identifier for the book. */
  id: number;
  /** The unique file path or directory path of the book. */
  file_path: string;
  /** The type of the item. */
  item_type: "file" | "directory";
  /** The display name of the book. */
  display_name: string;
  /** The total number of pages in the book. */
  total_pages: number;
  /** The optional identifier of the series this book belongs to. */
  series_id: number | null;
  /** The optional order index of the book within its series. */
  series_order: number | null;
  /** The optional file path to the thumbnail image of the book. */
  thumbnail_path: string | null;
  /** The last read page index, if the book has been opened. */
  last_read_page_index: number | null;
  /**
   * The timestamp when the book was last opened.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  last_opened_at: string | null;
  /** Comma-separated string of tag IDs. */
  tag_ids_str: string | null;
}

/**
 * Represents a bookshelf entity used to organize books.
 */
export interface Bookshelf {
  /** The unique identifier for the bookshelf. */
  id: number;
  /** The display name of the bookshelf. */
  name: string;
  /** The string identifier for the UI icon (e.g., "folder"). */
  icon_id: string;
  /**
   * The timestamp when the bookshelf was created.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  created_at: string;
}

/**
 * Represents a tag entity used to categorize books.
 */
export interface Tag {
  /** The unique identifier for the tag. */
  id: number;
  /** The unique name of the tag. */
  name: string;
  /** The color code of the tag (e.g., "#FF0000"). */
  color_code: string;
}

/**
 * Represents a series entity that groups multiple books together.
 */
export interface Series {
  /** The unique identifier for the series. */
  id: number;
  /** The unique name of the series. */
  name: string;
}
