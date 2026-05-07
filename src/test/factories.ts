import type { Bookshelf, BookWithState, ReadBook, Series, Tag } from "../types/DatabaseModels";
import type { DirEntry } from "../types/DirEntry";

/**
 * Creates a mock BookWithState object for testing.
 */
export const createMockBookWithState = (overrides?: Partial<BookWithState>): BookWithState => ({
  id: 1,
  display_name: "Mock Book",
  file_path: "/path/to/mock-book.zip",
  item_type: "file",
  total_pages: 100,
  last_read_page_index: 0,
  last_opened_at: "2026-03-18T12:00:00Z",
  series_id: null,
  series_order: null,
  thumbnail_path: null,
  tag_ids_str: null,
  ...overrides,
});

/**
 * Creates a mock ReadBook object for testing.
 */
export const createMockReadBook = (overrides?: Partial<ReadBook>): ReadBook => ({
  id: 1,
  display_name: "Mock Read Book",
  file_path: "/path/to/mock-read-book.zip",
  item_type: "file",
  total_pages: 100,
  last_read_page_index: 0,
  last_opened_at: "2026-03-18T12:00:00Z",
  series_id: null,
  series_order: null,
  thumbnail_path: null,
  ...overrides,
});

/**
 * Creates a mock Bookshelf object for testing.
 */
export const createMockBookshelf = (overrides?: Partial<Bookshelf>): Bookshelf => ({
  id: 1,
  name: "Mock Bookshelf",
  icon_id: "folder",
  created_at: "2026-03-18T12:00:00Z",
  ...overrides,
});

/**
 * Creates a mock Tag object for testing.
 */
export const createMockTag = (overrides?: Partial<Tag>): Tag => ({
  id: 1,
  name: "Mock Tag",
  color_code: "#ff0000",
  ...overrides,
});

/**
 * Creates a mock Series object for testing.
 */
export const createMockSeries = (overrides?: Partial<Series>): Series => ({
  id: 1,
  name: "Mock Series",
  created_at: "2026-03-01T15:30:00",
  ...overrides,
});

/**
 * Creates a mock DirEntry object for testing.
 */
export const createMockDirEntry = (overrides?: Partial<DirEntry>): DirEntry => ({
  name: "mock-entry.zip",
  is_directory: false,
  last_modified: "2026-03-18T12:00:00Z",
  ...overrides,
});
