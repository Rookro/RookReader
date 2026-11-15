import type {
  Bookmark,
  BookWithState,
  Collection,
  DirEntry,
  Series,
  Tag,
} from "../domain/entities";

/**
 * Creates a mock BookWithState object for testing.
 */
export const createMockBookWithState = (overrides?: Partial<BookWithState>): BookWithState => ({
  id: 1,
  displayName: "Mock Book",
  filePath: "/path/to/mock-book.zip",
  itemType: "file",
  totalPages: 100,
  createdAt: "2026-03-01T15:30:00Z",
  isSpreadShifted: false,
  landscapeBits: null,
  readingDirection: null,
  lastReadPageIndex: 0,
  lastOpenedAt: "2026-03-18T12:00:00Z",
  cfi: null,
  seriesId: null,
  seriesOrder: null,
  thumbnailPath: null,
  tagIds: [],
  ...overrides,
});

/**
 * Creates a mock Collection object for testing.
 */
export const createMockCollection = (overrides?: Partial<Collection>): Collection => ({
  id: 1,
  name: "Mock Collection",
  iconId: "folder",
  createdAt: "2026-03-18T12:00:00Z",
  ...overrides,
});

/**
 * Creates a mock Bookmark object for testing.
 */
export const createMockBookmark = (overrides?: Partial<Bookmark>): Bookmark => ({
  id: 1,
  bookId: 1,
  name: "Mock Bookmark",
  pageIndex: 0,
  cfi: null,
  createdAt: "2026-03-01T15:30:00Z",
  ...overrides,
});

/**
 * Creates a mock Tag object for testing.
 */
export const createMockTag = (overrides?: Partial<Tag>): Tag => ({
  id: 1,
  name: "Mock Tag",
  colorCode: "#ff0000",
  ...overrides,
});

/**
 * Creates a mock Series object for testing.
 */
export const createMockSeries = (overrides?: Partial<Series>): Series => ({
  id: 1,
  name: "Mock Series",
  createdAt: "2026-03-01T15:30:00Z",
  ...overrides,
});

/**
 * Creates a mock DirEntry object for testing.
 */
export const createMockDirEntry = (overrides?: Partial<DirEntry>): DirEntry => ({
  name: "mock-entry.zip",
  isDirectory: false,
  lastModified: Date.parse("2026-03-18T12:00:00Z"),
  ...overrides,
});
