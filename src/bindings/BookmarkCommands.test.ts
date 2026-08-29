import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as BookmarkCommands from "./BookmarkCommands";

vi.unmock("./BookmarkCommands");

describe("BookmarkCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createBookmark should call invoke", async () => {
    const mockBookmark = {
      id: 1,
      book_id: 2,
      name: "Chapter 3",
      page_index: 7,
      cfi: "epubcfi(/6/8!/4/2/1:0)",
      created_at: "2026-03-01T15:30:00",
    };
    vi.mocked(invoke).mockResolvedValue(mockBookmark);

    const result = await BookmarkCommands.createBookmark({
      bookId: 2,
      name: "Chapter 3",
      pageIndex: 7,
      cfi: "epubcfi(/6/8!/4/2/1:0)",
    });

    expect(invoke).toHaveBeenCalledWith("create_bookmark", {
      bookId: 2,
      name: "Chapter 3",
      pageIndex: 7,
      cfi: "epubcfi(/6/8!/4/2/1:0)",
    });
    expect(result).toEqual(mockBookmark);
  });

  it("getBookmarksByBookId should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await BookmarkCommands.getBookmarksByBookId(2);
    expect(invoke).toHaveBeenCalledWith("get_bookmarks_by_book_id", { bookId: 2 });
  });

  it("renameBookmark should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookmarkCommands.renameBookmark(1, "The duel");
    expect(invoke).toHaveBeenCalledWith("rename_bookmark", { id: 1, name: "The duel" });
  });

  it("deleteBookmark should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await BookmarkCommands.deleteBookmark(1);
    expect(invoke).toHaveBeenCalledWith("delete_bookmark", { id: 1 });
  });

  it("createBookmark should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(
      BookmarkCommands.createBookmark({ bookId: 2, name: "P1", pageIndex: 0, cfi: null }),
    ).rejects.toThrow(CommandError);
  });

  it("getBookmarksByBookId should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(BookmarkCommands.getBookmarksByBookId(2)).rejects.toThrow(CommandError);
  });

  it("renameBookmark should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(BookmarkCommands.renameBookmark(1, "x")).rejects.toThrow(CommandError);
  });

  it("deleteBookmark should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(BookmarkCommands.deleteBookmark(1)).rejects.toThrow(CommandError);
  });
});
