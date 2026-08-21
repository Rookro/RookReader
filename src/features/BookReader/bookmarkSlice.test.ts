import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookmarkCommands from "../../bindings/BookmarkCommands";
import { createMockBookmark } from "../../test/factories";
import { type AppStore, createTestStore } from "../../test/utils";
import { CommandError, ErrorCode } from "../../types/Error";
import bookmarkReducer, {
  addBookmark,
  clearBookmarkError,
  fetchBookmarks,
  removeBookmark,
  updateBookmarkName,
} from "./bookmarkSlice";

describe("BookmarkReducer", () => {
  let store: AppStore;

  const initialState = {
    bookmarks: [],
    status: "idle" as const,
    error: null as { code: ErrorCode; message?: string } | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is returned correctly
  it("should return the initial state", () => {
    expect(bookmarkReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  // Verify that the bookmark error state is cleared correctly
  it("should handle clearBookmarkError", () => {
    const stateWithError = structuredClone(initialState);
    stateWithError.error = { code: ErrorCode.other, message: "test error" };
    const nextState = bookmarkReducer(stateWithError, clearBookmarkError());
    expect(nextState.error).toBeNull();
  });

  describe("fetchBookmarks", () => {
    it("should mark the state as loading while fetching", () => {
      const nextState = bookmarkReducer(initialState, {
        type: fetchBookmarks.pending.type,
      });
      expect(nextState.status).toBe("loading");
      expect(nextState.error).toBeNull();
    });

    it("should replace the bookmarks on success", async () => {
      const bookmarks = [
        createMockBookmark({ id: 1, page_index: 0 }),
        createMockBookmark({ id: 2, page_index: 4 }),
      ];
      vi.mocked(BookmarkCommands.getBookmarksByBookId).mockResolvedValue(bookmarks);

      await store.dispatch(fetchBookmarks(1));

      const state = store.getState().bookmark;
      expect(BookmarkCommands.getBookmarksByBookId).toHaveBeenCalledWith(1);
      expect(state.bookmarks).toEqual(bookmarks);
      expect(state.status).toBe("succeeded");
    });

    it("should clear the bookmarks and record the error on failure", async () => {
      vi.mocked(BookmarkCommands.getBookmarksByBookId).mockRejectedValue(
        new CommandError(ErrorCode.other, "fetch failed"),
      );

      await store.dispatch(fetchBookmarks(1));

      const state = store.getState().bookmark;
      expect(state.bookmarks).toEqual([]);
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.other);
    });
  });

  describe("addBookmark", () => {
    // The list must stay in the backend's order so a newly added bookmark does not
    // appear at the end of the panel regardless of where it points.
    it("should insert the new bookmark in position order", async () => {
      const existing = [
        createMockBookmark({ id: 1, page_index: 0 }),
        createMockBookmark({ id: 2, page_index: 9 }),
      ];
      vi.mocked(BookmarkCommands.getBookmarksByBookId).mockResolvedValue(existing);
      await store.dispatch(fetchBookmarks(1));

      const added = createMockBookmark({ id: 3, page_index: 4, name: "Chapter 2" });
      vi.mocked(BookmarkCommands.createBookmark).mockResolvedValue(added);

      await store.dispatch(addBookmark({ bookId: 1, name: "Chapter 2", pageIndex: 4, cfi: null }));

      const state = store.getState().bookmark;
      expect(BookmarkCommands.createBookmark).toHaveBeenCalledWith({
        bookId: 1,
        name: "Chapter 2",
        pageIndex: 4,
        cfi: null,
      });
      expect(state.bookmarks.map((bookmark) => bookmark.id)).toEqual([1, 3, 2]);
    });

    it("should break ties on created_at and then id", () => {
      const state = {
        ...initialState,
        bookmarks: [
          createMockBookmark({ id: 5, page_index: 2, created_at: "2026-03-01T10:00:00" }),
        ],
      };

      const nextState = bookmarkReducer(state, {
        type: addBookmark.fulfilled.type,
        payload: createMockBookmark({ id: 4, page_index: 2, created_at: "2026-03-01T09:00:00" }),
      });

      expect(nextState.bookmarks.map((bookmark) => bookmark.id)).toEqual([4, 5]);
    });

    it("should record the error on failure", async () => {
      vi.mocked(BookmarkCommands.createBookmark).mockRejectedValue(
        new CommandError(ErrorCode.other, "add failed"),
      );

      await store.dispatch(addBookmark({ bookId: 1, name: "P1", pageIndex: 0, cfi: null }));

      const state = store.getState().bookmark;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.other);
    });
  });

  describe("removeBookmark", () => {
    it("should remove only the matching bookmark", async () => {
      const existing = [
        createMockBookmark({ id: 1, page_index: 0 }),
        createMockBookmark({ id: 2, page_index: 4 }),
      ];
      vi.mocked(BookmarkCommands.getBookmarksByBookId).mockResolvedValue(existing);
      await store.dispatch(fetchBookmarks(1));

      await store.dispatch(removeBookmark(1));

      const state = store.getState().bookmark;
      expect(BookmarkCommands.deleteBookmark).toHaveBeenCalledWith(1);
      expect(state.bookmarks.map((bookmark) => bookmark.id)).toEqual([2]);
    });

    it("should record the error on failure", async () => {
      vi.mocked(BookmarkCommands.deleteBookmark).mockRejectedValue(
        new CommandError(ErrorCode.other, "remove failed"),
      );

      await store.dispatch(removeBookmark(1));

      const state = store.getState().bookmark;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.other);
    });
  });

  describe("updateBookmarkName", () => {
    it("should rename the matching bookmark", async () => {
      const existing = [createMockBookmark({ id: 1, name: "Page 1" })];
      vi.mocked(BookmarkCommands.getBookmarksByBookId).mockResolvedValue(existing);
      await store.dispatch(fetchBookmarks(1));

      await store.dispatch(updateBookmarkName({ id: 1, name: "The duel" }));

      const state = store.getState().bookmark;
      expect(BookmarkCommands.renameBookmark).toHaveBeenCalledWith(1, "The duel");
      expect(state.bookmarks[0].name).toBe("The duel");
    });

    it("should leave the list untouched when the id is unknown", () => {
      const state = {
        ...initialState,
        bookmarks: [createMockBookmark({ id: 1, name: "Page 1" })],
      };

      const nextState = bookmarkReducer(state, {
        type: updateBookmarkName.fulfilled.type,
        payload: { id: 999, name: "Nowhere" },
      });

      expect(nextState.bookmarks[0].name).toBe("Page 1");
    });

    it("should record the error on failure", async () => {
      vi.mocked(BookmarkCommands.renameBookmark).mockRejectedValue(
        new CommandError(ErrorCode.other, "rename failed"),
      );

      await store.dispatch(updateBookmarkName({ id: 1, name: "x" }));

      const state = store.getState().bookmark;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.other);
    });
  });
});
