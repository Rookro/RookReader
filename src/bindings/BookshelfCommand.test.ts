import { describe, it, expect, vi, beforeEach } from "vitest";
import * as BookshelfCommand from "./BookshelfCommand";
import { invoke } from "@tauri-apps/api/core";
import { CommandError } from "../types/Error";

vi.unmock("./BookshelfCommand");

describe("BookshelfCommand", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  const mockError = { code: 123, message: "Fail" };

  it("getAllBookshelves should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookshelfCommand.getAllBookshelves();
    expect(invoke).toHaveBeenCalledWith("get_all_bookshelves");
  });

  it("getAllBookshelves should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookshelfCommand.getAllBookshelves()).rejects.toThrow(CommandError);
  });

  it("createBookshelf should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue({ id: 1, name: "Shelf" });
    await BookshelfCommand.createBookshelf("Shelf", "icon");
    expect(invoke).toHaveBeenCalledWith("create_bookshelf", { name: "Shelf", iconId: "icon" });
  });

  it("createBookshelf should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookshelfCommand.createBookshelf("S", "i")).rejects.toThrow(CommandError);
  });

  it("addBookToBookshelf should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookshelfCommand.addBookToBookshelf(1, 2);
    expect(invoke).toHaveBeenCalledWith("add_book_to_bookshelf", { bookshelfId: 1, bookId: 2 });
  });

  it("addBookToBookshelf should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookshelfCommand.addBookToBookshelf(1, 2)).rejects.toThrow(CommandError);
  });

  it("removeBookFromBookshelf should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookshelfCommand.removeBookFromBookshelf(1, 2);
    expect(invoke).toHaveBeenCalledWith("remove_book_from_bookshelf", {
      bookshelfId: 1,
      bookId: 2,
    });
  });

  it("removeBookFromBookshelf should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookshelfCommand.removeBookFromBookshelf(1, 2)).rejects.toThrow(CommandError);
  });

  it("deleteBookshelf should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookshelfCommand.deleteBookshelf(1);
    expect(invoke).toHaveBeenCalledWith("delete_bookshelf", { id: 1 });
  });

  it("deleteBookshelf should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(BookshelfCommand.deleteBookshelf(1)).rejects.toThrow(CommandError);
  });
});
