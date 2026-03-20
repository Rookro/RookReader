import { describe, it, expect, vi, beforeEach } from "vitest";
import * as BookCommands from "./BookCommands";
import { invoke } from "@tauri-apps/api/core";
import { CommandError } from "../types/Error";

vi.unmock("./BookCommands");

describe("BookCommands", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  const mockError = { code: 123, message: "Fail" };

  it("getBook should call invoke with correct arguments", async () => {
    const mockBook = { id: 1, display_name: "Test" };
    vi.mocked(invoke).mockResolvedValue(mockBook);

    const result = await BookCommands.getBook(1);
    expect(invoke).toHaveBeenCalledWith("get_book", { id: 1 });
    expect(result).toEqual(mockBook);
  });

  it("getBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBook(1)).rejects.toThrow(CommandError);
  });

  it("deleteBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookCommands.deleteBook(1);
    expect(invoke).toHaveBeenCalledWith("delete_book", { id: 1 });
  });

  it("deleteBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.deleteBook(1)).rejects.toThrow(CommandError);
  });

  it("getBookByPath should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    await BookCommands.getBookByPath("/path/to/book");
    expect(invoke).toHaveBeenCalledWith("get_book_by_path", { file_path: "/path/to/book" });
  });

  it("getBookByPath should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBookByPath("p")).rejects.toThrow(CommandError);
  });

  it("getBookWithStateById should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    await BookCommands.getBookWithStateById(1);
    expect(invoke).toHaveBeenCalledWith("get_book_with_state_by_id", { id: 1 });
  });

  it("getBookWithStateById should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBookWithStateById(1)).rejects.toThrow(CommandError);
  });

  it("getAllBooksWithState should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookCommands.getAllBooksWithState();
    expect(invoke).toHaveBeenCalledWith("get_all_books_with_state");
  });

  it("getAllBooksWithState should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getAllBooksWithState()).rejects.toThrow(CommandError);
  });

  it("upsertBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(10);
    const params = { filePath: "p", itemType: "file" as const, displayName: "d", totalPages: 100 };
    const result = await BookCommands.upsertBook(params);
    expect(invoke).toHaveBeenCalledWith("upsert_book", {
      filePath: "p",
      itemType: "file",
      displayName: "d",
      totalPages: 100,
    });
    expect(result).toBe(10);
  });

  it("upsertBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    const params = { filePath: "p", itemType: "file" as const, displayName: "d", totalPages: 100 };
    await expect(BookCommands.upsertBook(params)).rejects.toThrow(CommandError);
  });

  it("upsertReadBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(20);
    const params = {
      filePath: "p2",
      itemType: "directory" as const,
      displayName: "d2",
      totalPages: 0,
    };
    const result = await BookCommands.upsertReadBook(params);
    expect(invoke).toHaveBeenCalledWith("upsert_read_book", {
      filePath: "p2",
      itemType: "directory",
      displayName: "d2",
      totalPages: 0,
    });
    expect(result).toBe(20);
  });

  it("upsertReadBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    const params = {
      filePath: "p2",
      itemType: "directory" as const,
      displayName: "d2",
      totalPages: 0,
    };
    await expect(BookCommands.upsertReadBook(params)).rejects.toThrow(CommandError);
  });

  it("getBookTags should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([1, 2, 3]);
    const result = await BookCommands.getBookTags(1);
    expect(invoke).toHaveBeenCalledWith("get_book_tags", { bookId: 1 });
    expect(result).toEqual([1, 2, 3]);
  });

  it("getBookTags should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBookTags(1)).rejects.toThrow(CommandError);
  });

  it("updateBookTags should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookCommands.updateBookTags(1, [1, 2]);
    expect(invoke).toHaveBeenCalledWith("update_book_tags", { bookId: 1, tagIds: [1, 2] });
  });

  it("updateBookTags should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.updateBookTags(1, [1])).rejects.toThrow(CommandError);
  });

  it("upsertReadingState should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const state = { book_id: 1, last_read_page_index: 5, last_opened_at: "now" };
    await BookCommands.upsertReadingState(state);
    expect(invoke).toHaveBeenCalledWith("upsert_reading_state", { stateData: state });
  });

  it("upsertReadingState should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    const state = { book_id: 1, last_read_page_index: 5, last_opened_at: "now" };
    await expect(BookCommands.upsertReadingState(state)).rejects.toThrow(CommandError);
  });

  it("clearReadingHistory should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookCommands.clearReadingHistory(1);
    expect(invoke).toHaveBeenCalledWith("clear_reading_history", { bookId: 1 });
  });

  it("clearReadingHistory should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.clearReadingHistory(1)).rejects.toThrow(CommandError);
  });

  it("clearAllReadingHistory should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookCommands.clearAllReadingHistory();
    expect(invoke).toHaveBeenCalledWith("clear_all_reading_history");
  });

  it("clearAllReadingHistory should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.clearAllReadingHistory()).rejects.toThrow(CommandError);
  });

  it("getRecentlyReadBooks should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookCommands.getRecentlyReadBooks();
    expect(invoke).toHaveBeenCalledWith("get_recently_read_books");
  });

  it("getRecentlyReadBooks should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getRecentlyReadBooks()).rejects.toThrow(CommandError);
  });

  it("getBooksWithStateByBookshelfId should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookCommands.getBooksWithStateByBookshelfId(1);
    expect(invoke).toHaveBeenCalledWith("get_books_with_state_by_bookshelf_id", { bookshelfId: 1 });
  });

  it("getBooksWithStateByBookshelfId should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBooksWithStateByBookshelfId(1)).rejects.toThrow(CommandError);
  });

  it("getBooksWithStateByTagId should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookCommands.getBooksWithStateByTagId(2);
    expect(invoke).toHaveBeenCalledWith("get_books_with_state_by_tag_id", { tagId: 2 });
  });

  it("getBooksWithStateByTagId should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBooksWithStateByTagId(1)).rejects.toThrow(CommandError);
  });

  it("getBooksWithStateBySeriesId should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookCommands.getBooksWithStateBySeriesId(3);
    expect(invoke).toHaveBeenCalledWith("get_books_with_state_by_series_id", { seriesId: 3 });
  });

  it("getBooksWithStateBySeriesId should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.getBooksWithStateBySeriesId(1)).rejects.toThrow(CommandError);
  });
});
