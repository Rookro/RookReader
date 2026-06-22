import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as BookCommands from "./BookCommands";

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
    expect(invoke).toHaveBeenCalledWith("get_book_by_path", { filePath: "/path/to/book" });
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

  it("registerBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(10);
    const params = { filePath: "p", itemType: "file" as const, displayName: "d", totalPages: 100 };
    const result = await BookCommands.registerBook(params);
    expect(invoke).toHaveBeenCalledWith("register_book", {
      filePath: "p",
      itemType: "file",
      displayName: "d",
      totalPages: 100,
    });
    expect(result).toBe(10);
  });

  it("registerBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    const params = { filePath: "p", itemType: "file" as const, displayName: "d", totalPages: 100 };
    await expect(BookCommands.registerBook(params)).rejects.toThrow(CommandError);
  });

  it("recordBookOpened should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(20);
    const params = {
      filePath: "p2",
      itemType: "directory" as const,
      displayName: "d2",
      totalPages: 0,
    };
    const result = await BookCommands.recordBookOpened(params);
    expect(invoke).toHaveBeenCalledWith("record_book_opened", {
      filePath: "p2",
      itemType: "directory",
      displayName: "d2",
      totalPages: 0,
    });
    expect(result).toBe(20);
  });

  it("recordBookOpened should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    const params = {
      filePath: "p2",
      itemType: "directory" as const,
      displayName: "d2",
      totalPages: 0,
    };
    await expect(BookCommands.recordBookOpened(params)).rejects.toThrow(CommandError);
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

  it("updateReadingProgress should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const state = { book_id: 1, last_read_page_index: 5, last_opened_at: "now" };
    await BookCommands.updateReadingProgress(state);
    expect(invoke).toHaveBeenCalledWith("update_reading_progress", { stateData: state });
  });

  it("updateReadingProgress should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    const state = { book_id: 1, last_read_page_index: 5, last_opened_at: "now" };
    await expect(BookCommands.updateReadingProgress(state)).rejects.toThrow(CommandError);
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
    // `limit` is `Option<i64>`; the wrapper passes `null` to request the default.
    expect(invoke).toHaveBeenCalledWith("get_recently_read_books", { limit: null });
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

  it("updateBookSeries should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookCommands.updateBookSeries(1, 10);
    expect(invoke).toHaveBeenCalledWith("update_book_series", { bookId: 1, seriesId: 10 });
  });

  it("updateBookSeries should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.updateBookSeries(1, 10)).rejects.toThrow(CommandError);
  });

  it("updateSeriesOrders should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookCommands.updateSeriesOrders([1, 2, 3]);
    expect(invoke).toHaveBeenCalledWith("update_series_orders", { bookIds: [1, 2, 3] });
  });

  it("updateSeriesOrders should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookCommands.updateSeriesOrders([1, 2, 3])).rejects.toThrow(CommandError);
  });

  it("should handle non-standard error objects using createCommandError", async () => {
    const strangeError = "Something went wrong";
    vi.mocked(invoke).mockRejectedValue(strangeError);

    try {
      await BookCommands.getBook(1);
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError);
      const cmdError = error as CommandError;
      expect(cmdError.message).toContain("Unknown error");
      expect(cmdError.message).toContain("Something went wrong");
    }
  });
});
