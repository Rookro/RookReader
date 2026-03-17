import { vi } from "vitest";

vi.mock("../../bindings/BookCommands", () => ({
  getBook: vi.fn(() => Promise.resolve([])),
  deleteBook: vi.fn(() => Promise.resolve([])),
  getBookByPath: vi.fn(() => Promise.resolve([])),
  getBookWithStateById: vi.fn(() => Promise.resolve([])),
  getAllBooksWithState: vi.fn(() => Promise.resolve([])),
  upsertBook: vi.fn(() => Promise.resolve([])),
  upsertReadBook: vi.fn(() => Promise.resolve([])),
  getBookTags: vi.fn(() => Promise.resolve([])),
  updateBookTags: vi.fn(() => Promise.resolve([])),
  upsertReadingState: vi.fn(() => Promise.resolve([])),
  clearReadingHistory: vi.fn(() => Promise.resolve([])),
  clearAllReadingHistory: vi.fn(() => Promise.resolve([])),
  getRecentlyReadBooks: vi.fn(() => Promise.resolve([])),
  getBooksWithStateByBookshelfId: vi.fn(() => Promise.resolve([])),
  getBooksWithStateByTagId: vi.fn(() => Promise.resolve([])),
  getBooksWithStateBySeriesId: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../bindings/BookshelfCommand", () => ({
  createBookshelf: vi.fn(() => Promise.resolve([])),
  getAllBookshelves: vi.fn(() => Promise.resolve([])),
  addBookToBookshelf: vi.fn(() => Promise.resolve([])),
  removeBookFromBookshelf: vi.fn(() => Promise.resolve([])),
  deleteBookshelf: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../bindings/ContainerCommands", () => ({
  getEntriesInContainer: vi.fn(() => Promise.resolve([])),
  getImage: vi.fn(() => Promise.resolve([])),
  getImagePreview: vi.fn(() => Promise.resolve([])),
  setPdfRenderingHeight: vi.fn(() => Promise.resolve([])),
  setMaxImageHeight: vi.fn(() => Promise.resolve([])),
  setImageResizeMethod: vi.fn(() => Promise.resolve([])),
  determineEpubNovel: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../bindings/DirectoryCommands", () => ({
  getEntriesInDir: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../bindings/FontCommands", () => ({
  getFonts: vi.fn(() => Promise.resolve(["Arial", "Times New Roman"])),
}));

vi.mock("../../bindings/SeriesCommand", () => ({
  createSeries: vi.fn(() => Promise.resolve([])),
  getAllSeries: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../bindings/TagCommands", () => ({
  createTag: vi.fn(() => Promise.resolve([])),
  getAllTags: vi.fn(() => Promise.resolve([])),
  deleteTag: vi.fn(() => Promise.resolve([])),
}));
