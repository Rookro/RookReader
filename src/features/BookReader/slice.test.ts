import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../bindings/api";
import * as binaryApi from "../../bindings/binaryApi";
import { createMockBookWithState } from "../../test/factories";
import {
  type AppStore,
  createBasePreloadedState,
  createTestStore,
  type RootState,
} from "../../test/utils";
import { CommandError, ErrorCode } from "../../types/Error";
import readerReducer, {
  bookPathOpened,
  goBackBookHistory,
  goForwardBookHistory,
  historyMovedBack,
  historyMovedForward,
  loadBook,
  openBook,
  restoreLastBook,
  setEntries,
  setImageIndex,
  setNovelDirection,
  setNovelLocation,
  setReadingDirection,
  setSpreadDisplayed,
  setSpreadShifted,
  toggleReadingDirection,
  toggleSpreadShift,
} from "./slice";
import type { OpenOrigin } from "./types/OpenOrigin";

type Opened = Awaited<ReturnType<typeof api.openBook>>;

/** An `open_book` result: an empty comic that was recorded without a book row. */
const opened = (overrides: Partial<Opened> = {}): Opened => ({
  entries: [],
  isDirectory: false,
  isNovel: false,
  hasPreviews: false,
  book: null,
  recordError: null,
  ...overrides,
});

describe("ReaderReducer", () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  describe("reducers", () => {
    // Verify that initial state is set correctly
    it("should handle initial state", () => {
      expect(readerReducer(undefined, { type: "unknown" })).toBeDefined();
    });

    // Verify that image index is set correctly and CFI is cleared
    describe("origin per history entry", () => {
      const shelf: OpenOrigin = { kind: "bookshelf", collectionId: 5, sortOrder: "name_asc" };

      // A typed path has no shelf behind it, so "next book" must not search the shelf
      it("typing a path drops the previous book's origin", () => {
        let state = readerReducer(undefined, bookPathOpened({ path: "/s/v1.zip", origin: shelf }));
        state = readerReducer(state, bookPathOpened({ path: "/other/x.zip", origin: null }));
        expect(state.origin).toBeNull();
      });

      it("back and forward restore each entry's origin", () => {
        let state = readerReducer(undefined, bookPathOpened({ path: "/s/v1.zip", origin: shelf }));
        state = readerReducer(
          state,
          bookPathOpened({ path: "/d/a.zip", origin: { kind: "fileNavigator" } }),
        );
        state = readerReducer(state, historyMovedBack());
        expect(state.origin).toEqual(shelf);
        state = readerReducer(state, historyMovedForward());
        expect(state.origin).toEqual({ kind: "fileNavigator" });
      });

      it("a new open after going back drops the forward origins", () => {
        let state = readerReducer(undefined, bookPathOpened({ path: "/a", origin: shelf }));
        state = readerReducer(state, bookPathOpened({ path: "/b", origin: null }));
        state = readerReducer(state, historyMovedBack());
        state = readerReducer(state, bookPathOpened({ path: "/c", origin: { kind: "history" } }));
        expect(state.originHistory).toEqual([shelf, { kind: "history" }]);
      });
    });

    // Choosing the section the novel is already in must keep the exact position
    it("keeps the CFI when setImageIndex names the current section", () => {
      const initialState = {
        isNovel: true,
        index: 3,
        cfi: "epubcfi(/6/8!/4/2)",
      } as RootState["reader"];
      expect(readerReducer(initialState, setImageIndex(3)).cfi).toBe("epubcfi(/6/8!/4/2)");
      expect(readerReducer(initialState, setImageIndex(4)).cfi).toBeNull();
    });

    it("should handle setImageIndex", () => {
      const initialState = { index: 0, cfi: "old-cfi" } as RootState["reader"];
      const state = readerReducer(initialState, setImageIndex(10));
      expect(state.index).toBe(10);
      expect(state.cfi).toBeNull();
    });

    // Verify that the shifted flag is stored as given
    it("should handle setSpreadShifted", () => {
      const initialState = { isSpreadShifted: false } as RootState["reader"];
      const state = readerReducer(initialState, setSpreadShifted(true));
      expect(state.isSpreadShifted).toBe(true);
    });

    // Verify that the displayed-spread flag is stored as given
    it("should handle setSpreadDisplayed", () => {
      const initialState = { isSpreadDisplayed: false } as RootState["reader"];
      const state = readerReducer(initialState, setSpreadDisplayed(true));
      expect(state.isSpreadDisplayed).toBe(true);
    });

    // Verify that opening another book never leaves a stale spread flag behind
    it("should clear the displayed-spread flag when a book starts opening", () => {
      const initialState = { isSpreadDisplayed: true } as RootState["reader"];
      const state = readerReducer(initialState, loadBook.pending("requestId", "/books/a.zip"));
      expect(state.isSpreadDisplayed).toBe(false);
    });

    // Verify that page turns never change the pairing
    it("should leave the shifted flag untouched on setImageIndex", () => {
      const initialState = { index: 0, isSpreadShifted: true, cfi: null } as RootState["reader"];
      const state = readerReducer(initialState, setImageIndex(10));
      expect(state.isSpreadShifted).toBe(true);
    });

    // Verify that a new path is added to the history
    it("should handle bookPathOpened and update history", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["old"],
        historyIndex: 0,
      } as RootState["reader"];
      const state = readerReducer(initialState, bookPathOpened({ path: "new", origin: null }));
      expect(state.history).toEqual(["old", "new"]);
      expect(state.historyIndex).toBe(1);
    });

    // Verify that opening another book drops the previous book's shifted pairing
    it("should reset the shifted flag when a book starts opening", () => {
      const initialState = { isSpreadShifted: true } as RootState["reader"];
      const state = readerReducer(initialState, loadBook.pending("requestId", "new"));
      expect(state.isSpreadShifted).toBe(false);
    });

    // Verify that history is not updated when bookPathOpened is called with current path
    it("should not update history if bookPathOpened is called with current path", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["current"],
        historyIndex: 0,
      } as RootState["reader"];
      const state = readerReducer(initialState, bookPathOpened({ path: "current", origin: null }));
      expect(state.history).toHaveLength(1);
    });

    // Verify that a no-op open (same path) clears any pending initial position
    it("should clear pendingInitialPosition on a no-op bookPathOpened", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["current"],
        historyIndex: 0,
        pendingInitialPosition: "last",
      } as RootState["reader"];
      const state = readerReducer(initialState, bookPathOpened({ path: "current", origin: null }));
      expect(state.history).toHaveLength(1);
      expect(state.pendingInitialPosition).toBeNull();
    });

    // Verify that subsequent history is sliced when a new path is set while in the middle of history
    it("should slice history in bookPathOpened when index is not at the end", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["p1", "p2", "p3"],
        historyIndex: 1,
      } as RootState["reader"];
      const state = readerReducer(initialState, bookPathOpened({ path: "new", origin: null }));
      expect(state.history).toEqual(["p1", "p2", "new"]);
      expect(state.historyIndex).toBe(2);
    });

    // Verify that book history navigation (back/forward) works correctly
    it("should handle history navigation", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["p1", "p2", "p3"],
        historyIndex: 1,
      } as RootState["reader"];

      let state = readerReducer(initialState, historyMovedBack());
      expect(state.historyIndex).toBe(0);
      state = readerReducer(state, historyMovedBack()); // Should not go below 0
      expect(state.historyIndex).toBe(0);

      state = readerReducer(initialState, historyMovedForward());
      expect(state.historyIndex).toBe(2);
      state = readerReducer(state, historyMovedForward()); // Should not go beyond length - 1
      expect(state.historyIndex).toBe(2);
    });

    // Verify that entry list is set correctly
    it("should handle setEntries", () => {
      const initialState = { entries: [] as string[] } as RootState["reader"];
      const state = readerReducer(initialState, setEntries(["e1", "e2"]));
      expect(state.entries).toEqual(["e1", "e2"]);
    });

    // Verify that novel location (index and CFI) is set correctly
    it("should handle setNovelLocation", () => {
      const initialState = { index: 0, cfi: null } as RootState["reader"];
      const state = readerReducer(initialState, setNovelLocation({ index: 5, cfi: "epub-cfi" }));
      expect(state.index).toBe(5);
      expect(state.cfi).toBe("epub-cfi");
    });

    // Verify that the detected novel direction is stored as given
    it("should handle setNovelDirection", () => {
      const initialState = { novelDirection: null } as RootState["reader"];
      const state = readerReducer(initialState, setNovelDirection("rtl"));
      expect(state.novelDirection).toBe("rtl");
    });

    // Verify that bookPathOpened records the origin together with the path
    it("should record the origin with bookPathOpened", () => {
      const initialState = {
        history: ["old"],
        originHistory: [null],
        historyIndex: 0,
        origin: null,
        pendingInitialPosition: null,
      } as RootState["reader"];

      const state = readerReducer(
        initialState,
        bookPathOpened({
          path: "new",
          origin: { kind: "bookshelf", collectionId: 3, sortOrder: "name_asc" },
        }),
      );
      expect(state.origin).toEqual({
        kind: "bookshelf",
        collectionId: 3,
        sortOrder: "name_asc",
      });
      expect(state.history).toEqual(["old", "new"]);
      expect(state.historyIndex).toBe(1);

      const cleared = readerReducer(state, bookPathOpened({ path: "other", origin: null }));
      expect(cleared.origin).toBeNull();
    });

    it("should record the origin but keep the view on a no-op bookPathOpened", () => {
      const initialState = {
        history: ["current"],
        originHistory: [{ kind: "history" }],
        historyIndex: 0,
        index: 7,
        isLoading: false,
        origin: { kind: "history" },
        pendingInitialPosition: "last",
      } as RootState["reader"];

      const state = readerReducer(
        initialState,
        bookPathOpened({ path: "current", origin: { kind: "dragDrop" } }),
      );
      expect(state.origin).toEqual({ kind: "dragDrop" });
      expect(state.history).toEqual(["current"]);
      expect(state.index).toBe(7);
      expect(state.isLoading).toBe(false);
      // The same-path guard still drops a stale pending position.
      expect(state.pendingInitialPosition).toBeNull();
    });

    // Verify that an open sets the pending initial position only when it names one
    it("should set pendingInitialPosition only when bookPathOpened names one", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: [] as string[],
        historyIndex: -1,
        pendingInitialPosition: null,
      } as RootState["reader"];

      const state = readerReducer(
        initialState,
        bookPathOpened({ path: "a", origin: null, initialPosition: "last" }),
      );
      expect(state.pendingInitialPosition).toBe("last");

      const kept = readerReducer(state, bookPathOpened({ path: "b", origin: null }));
      expect(kept.pendingInitialPosition).toBe("last");
    });
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify that the previous book's detected direction cannot survive into the next one
    it("should clear novelDirection when a container starts opening", () => {
      const initialState = { novelDirection: "rtl" } as RootState["reader"];

      const state = readerReducer(
        initialState,
        loadBook.pending("requestId", "/path/to/book.epub"),
      );
      expect(state.novelDirection).toBeNull();
    });

    // The previous book must not receive the next book's progress or bookmarks while it opens
    it("should forget the previous book when an open starts", () => {
      const state = readerReducer(
        { book: createMockBookWithState({ id: 1 }) } as RootState["reader"],
        loadBook.pending("requestId", "/b.zip"),
      );
      expect(state.book).toBeNull();
    });

    // Verify that a failed open leaves no direction behind, like the other book state
    it("should clear novelDirection when opening fails", () => {
      const initialState = {
        novelDirection: "rtl",
        history: ["arg"],
        historyIndex: 0,
      } as RootState["reader"];

      const state = readerReducer(
        initialState,
        loadBook.rejected(new Error(), "requestId", "arg", undefined),
      );
      expect(state.novelDirection).toBeNull();
    });

    describe("loadBook thunk", () => {
      // Verify that container is opened and state is updated on success
      it("should open container and update state on success", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 1 });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        expect(api.openBook).toHaveBeenCalledWith("path/to/book.zip");
        const state = store.getState().reader;
        expect(state.isLoading).toBe(false);
        expect(state.book).toEqual(mockBook);
        expect(state.index).toBe(1);
        expect(state.entries).toEqual(["p1", "p2"]);
        // The book carries no correction, so the pairing is the one it measures.
        expect(state.isSpreadShifted).toBe(false);
      });

      // The viewer asks for previews only when the open book says it has them
      it("keeps whether the open book has previews, and forgets it on the next open", async () => {
        vi.mocked(api.openBook).mockResolvedValueOnce(
          opened({
            entries: ["0000"],
            hasPreviews: true,
            book: createMockBookWithState({ id: 1 }),
          }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.pdf", origin: null }));
        await store.dispatch(loadBook("path/to/book.pdf"));
        expect(store.getState().reader.hasPreviews).toBe(true);

        vi.mocked(api.openBook).mockReturnValueOnce(new Promise(() => {}));
        store.dispatch(bookPathOpened({ path: "path/to/other.zip", origin: null }));
        void store.dispatch(loadBook("path/to/other.zip"));
        expect(store.getState().reader.hasPreviews).toBe(false);
      });

      // Verify that a book which opened stays on screen when the library cannot record it
      it("keeps the pages when recording the opened book fails", async () => {
        vi.mocked(api.openBook).mockResolvedValue(
          opened({
            entries: ["p1", "p2"],
            recordError: {
              code: ErrorCode.database,
              message: "database is locked",
              details: null,
            },
          }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        const result = await store.dispatch(loadBook("path/to/book.zip"));

        // It used to reject, which emptied the reader and claimed the book itself
        // could not be opened.
        expect(result.type).toBe("reader/loadBook/fulfilled");
        const state = store.getState().reader;
        expect(state.entries).toEqual(["p1", "p2"]);
        expect(state.book).toBeNull();
      });

      // The open-time window is the one that races the viewer's first request: it must
      // leave the pages the viewer is about to ask for to the viewer.
      it("leaves the pages the viewer will load out of the opening window", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 4 });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2", "p3", "p4", "p5", "p6"], book: mockBook }),
        );

        await store.dispatch(loadBook("path/to/book.zip"));

        // The test store's default reader shows spreads, so the viewer will ask for two.
        expect(api.requestPreloadAround).toHaveBeenCalledWith(
          "path/to/book.zip",
          4,
          store.getState().settings.reader.comic.cache.preloadPageCount,
          2,
        );
      });

      // Verify the reader's own correction comes back with the book
      it("restores the spread shift from the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, isSpreadShifted: true });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        // It used to be inferred from whether the restored page happened to be a spread
        // boundary, which made where the reader stopped decide how the book pairs.
        expect(store.getState().reader.isSpreadShifted).toBe(true);
      });

      // Verify the toggle both applies and persists
      it("toggleSpreadShift flips the flag and stores it against the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, isSpreadShifted: false });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        await store.dispatch(toggleSpreadShift());

        expect(store.getState().reader.isSpreadShifted).toBe(true);
        expect(api.updateSpreadShift).toHaveBeenCalledWith(7, true);
      });

      // Verify a book that could not be recorded still pairs as the reader asked
      it("toggleSpreadShift still applies when there is no book to store it against", async () => {
        vi.mocked(api.openBook).mockResolvedValue(
          opened({
            entries: ["p1", "p2"],
            recordError: { code: ErrorCode.database, message: "not recorded", details: null },
          }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        await store.dispatch(toggleSpreadShift());

        expect(store.getState().reader.isSpreadShifted).toBe(true);
        expect(api.updateSpreadShift).not.toHaveBeenCalled();
      });

      // The backend seeds a new comic's direction; when it recorded none (the settings
      // could not be read), the reader falls back to its default without storing one.
      it("leaves the direction to the reader's default when the backend recorded none", async () => {
        const mockBook = createMockBookWithState({ id: 7, readingDirection: null });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        expect(store.getState().reader.readingDirection).toBeNull();
        expect(api.updateReadingDirection).not.toHaveBeenCalled();
      });

      // Verify the direction comes from the book, not the default, and is not rewritten
      it("uses the direction the backend recorded for the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, readingDirection: "ltr" });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        expect(store.getState().reader.readingDirection).toBe("ltr");
        expect(api.updateReadingDirection).not.toHaveBeenCalled();
      });

      // A novel's direction is the EPUB's own, so nothing is seeded against it
      it("leaves a novel's reading direction unset", async () => {
        const mockBook = createMockBookWithState({ id: 7, readingDirection: "rtl" });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["Chapter 1"], isNovel: true, book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.epub", origin: null }));
        await store.dispatch(loadBook("path/to/book.epub"));

        expect(store.getState().reader.readingDirection).toBeNull();
        expect(api.updateReadingDirection).not.toHaveBeenCalled();
      });

      // Verify the toggle both applies and persists, against the book alone
      it("toggleReadingDirection flips the direction and stores it against the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, readingDirection: "rtl" });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        await store.dispatch(toggleReadingDirection());

        expect(store.getState().reader.readingDirection).toBe("ltr");
        expect(api.updateReadingDirection).toHaveBeenCalledWith(7, "ltr");
        // The default is the seed for new books only; flipping one book must not move it.
        expect(store.getState().settings.reader.comic.readingDirection).toBe("rtl");
      });

      // Verify that the container opens on its last page when pendingInitialPosition is "last"
      it("should open on the last page when pendingInitialPosition is 'last'", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 5 });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2", "p3"], book: mockBook }),
        );

        store.dispatch(
          bookPathOpened({ path: "path/to/book.zip", origin: null, initialPosition: "last" }),
        );
        await store.dispatch(loadBook("path/to/book.zip"));

        const state = store.getState().reader;
        // Last page index (entries.length - 1), not lastReadPageIndex.
        expect(state.index).toBe(2);
        expect(state.pendingInitialPosition).toBeNull();
      });

      // Verify that the container opens on its first page when pendingInitialPosition is "first"
      it("should open on the first page when pendingInitialPosition is 'first'", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 5 });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2", "p3"], book: mockBook }),
        );

        store.dispatch(
          bookPathOpened({ path: "path/to/book.zip", origin: null, initialPosition: "first" }),
        );
        await store.dispatch(loadBook("path/to/book.zip"));

        const state = store.getState().reader;
        // First page (index 0), not lastReadPageIndex.
        expect(state.index).toBe(0);
        expect(state.pendingInitialPosition).toBeNull();
      });

      // Verify that a stale lastReadPageIndex past the page count is clamped to the last page
      it("should clamp a restored index past the page count to the last page", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 10 });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2", "p3"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        const state = store.getState().reader;
        // Restored index 10 is clamped to entries.length - 1 (2), not left out of range.
        expect(state.index).toBe(2);
      });

      // Verify that a novel's persisted CFI is restored on open
      it("should restore the persisted CFI when opening an EPUB novel", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          lastReadPageIndex: 3,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["s1", "s2", "s3", "s4"], isNovel: true, book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path.epub", origin: null }));
        await store.dispatch(loadBook("path.epub"));

        const state = store.getState().reader;
        expect(state.index).toBe(3);
        expect(state.cfi).toBe("epubcfi(/6/8!/4/2/1:0)");
      });

      // Verify that a comic never restores a CFI, even if the row carries a stale one
      it("should keep cfi null when opening a comic", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          lastReadPageIndex: 1,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path/to/book.zip", origin: null }));
        await store.dispatch(loadBook("path/to/book.zip"));

        expect(store.getState().reader.cfi).toBeNull();
      });

      // Verify that adjacent-book "first"/"last" overrides win over the CFI restore
      it("should not restore the CFI when pendingInitialPosition is set", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          lastReadPageIndex: 3,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["s1", "s2", "s3"], isNovel: true, book: mockBook }),
        );

        store.dispatch(
          bookPathOpened({ path: "path.epub", origin: null, initialPosition: "first" }),
        );
        await store.dispatch(loadBook("path.epub"));

        const state = store.getState().reader;
        expect(state.index).toBe(0);
        expect(state.cfi).toBeNull();
      });

      // Verify handling of EPUB novel format
      it("should handle EPUB novel", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 0 });
        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], isNovel: true, book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "path.epub", origin: null }));
        await store.dispatch(loadBook("path.epub"));

        const state = store.getState().reader;
        expect(state.isNovel).toBe(true);
        expect(api.openBook).toHaveBeenCalled();
      });

      // Verify that a stale fulfilled response (for a book the user already navigated
      // away from) does not overwrite the newer book's state.
      it("should ignore a stale fulfilled response for a superseded book", () => {
        // Current head is the newer book "new.zip" with its own loaded state.
        const initialState = {
          history: ["new.zip"],
          historyIndex: 0,
          entries: ["n1", "n2"],
          book: createMockBookWithState({ id: 2 }),
          index: 1,
          isNovel: false,
          isDirectory: false,
          isLoading: false,
          cfi: null,
          pendingInitialPosition: null,
        } as unknown as RootState["reader"];

        // A slow open for the previous book "old.zip" finally resolves.
        const staleAction = loadBook.fulfilled(
          {
            entries: ["o1", "o2", "o3"],
            isDirectory: false,
            isNovel: false,
            hasPreviews: false,
            book: createMockBookWithState({ id: 1 }),
            readingDirection: "rtl",
          },
          "requestId",
          "old.zip",
        );
        const state = readerReducer(initialState, staleAction);

        // The newer book's state is preserved, unchanged by the stale response.
        expect(state.entries).toEqual(["n1", "n2"]);
        expect(state.book?.id).toBe(2);
        expect(state.index).toBe(1);
      });

      // Verify error handling when path is empty
      it("should handle error when path is empty", async () => {
        store.dispatch(bookPathOpened({ path: "", origin: null }));
        await store.dispatch(loadBook(""));

        const state = store.getState().reader;
        expect(state.isLoading).toBe(false);
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "open-container", code: ErrorCode.path },
        ]);
      });

      // Verify handling of CommandError during opening
      it("should handle CommandError during open", async () => {
        const mockError = new CommandError(ErrorCode.other, "cmd failed");
        vi.mocked(api.openBook).mockRejectedValue(mockError);

        store.dispatch(bookPathOpened({ path: "fail.zip", origin: null }));
        await store.dispatch(loadBook("fail.zip"));

        expect(store.getState().errorNotification.pending).toEqual([
          { context: "open-container", code: ErrorCode.other },
        ]);
      });
    });

    describe("loadBook thunk error cases", () => {
      // Verify handling of generic error during container open
      it("should handle generic error during container open", async () => {
        const testError = "open failed";
        vi.mocked(api.openBook).mockRejectedValue(testError);

        store.dispatch(bookPathOpened({ path: "fail.zip", origin: null }));
        await store.dispatch(loadBook("fail.zip"));

        const state = store.getState().reader;
        expect(state.isLoading).toBe(false);
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "open-container", code: ErrorCode.other },
        ]);
      });

      // Dropping an archive whose pages all live in sub-folders must not strand the
      // user on the previously opened book: the navigator moves into the dropped path
      // so its folders can be opened from there.
      it("should move the file navigator into the path when it has no readable pages", async () => {
        // A folder row, so the listing looks like an archive with sub-folders.
        const name = "ch1";
        const nameBuffer = new TextEncoder().encode(name);
        const buffer = new ArrayBuffer(1 + 4 + nameBuffer.byteLength + 8);
        const view = new DataView(buffer);
        view.setUint8(0, 1); // isDirectory = true
        view.setUint32(1, nameBuffer.byteLength);
        new Uint8Array(buffer).set(nameBuffer, 5);
        view.setBigUint64(5 + nameBuffer.byteLength, BigInt(0));

        vi.mocked(api.openBook).mockRejectedValue(
          new CommandError(ErrorCode.emptyContainer, "Empty Container Error: multi.zip"),
        );
        vi.mocked(binaryApi.getEntriesInDir).mockResolvedValue(buffer);

        store.dispatch(bookPathOpened({ path: "multi.zip", origin: null }));
        await store.dispatch(loadBook("multi.zip"));

        const { fileNavigator, reader } = store.getState();
        expect(fileNavigator.history[fileNavigator.historyIndex]).toBe("multi.zip");
        expect(fileNavigator.entries.map((entry) => entry.name)).toEqual(["ch1"]);
        // The reader sits on the dropped path with no pages, not on the previous book.
        expect(reader.history[reader.historyIndex]).toBe("multi.zip");
        expect(reader.entries).toEqual([]);
      });

      // A slow failure must not drag the navigator away from a book opened after it.
      it("should not move the file navigator when another book was opened meanwhile", async () => {
        vi.mocked(api.openBook).mockRejectedValue(
          new CommandError(ErrorCode.emptyContainer, "Empty Container Error: stale.zip"),
        );

        // `stale.zip` is no longer the head of the book history.
        store.dispatch(bookPathOpened({ path: "current.zip", origin: null }));
        await store.dispatch(loadBook("stale.zip"));

        expect(binaryApi.getEntriesInDir).not.toHaveBeenCalled();
      });

      // Other failures leave the navigator alone: there is no path worth entering.
      it("should not move the file navigator for a failure other than an empty container", async () => {
        vi.mocked(api.openBook).mockRejectedValue(
          new CommandError(ErrorCode.zip, "Zip Error: corrupt"),
        );

        store.dispatch(bookPathOpened({ path: "broken.zip", origin: null }));
        await store.dispatch(loadBook("broken.zip"));

        expect(binaryApi.getEntriesInDir).not.toHaveBeenCalled();
      });

      // A failed open must not leave the previous book's title, type or reading state
      // on screen.
      it("should clear the previously opened book when opening fails", async () => {
        const mockBook = createMockBookWithState({ id: 1, lastReadPageIndex: 1 });
        vi.mocked(api.openBook).mockResolvedValue(
          opened({ entries: ["p1", "p2"], isDirectory: true, isNovel: true, book: mockBook }),
        );

        store.dispatch(bookPathOpened({ path: "good.zip", origin: null }));
        await store.dispatch(loadBook("good.zip"));
        expect(store.getState().reader.book).not.toBeNull();

        vi.mocked(api.openBook).mockRejectedValue("boom");
        store.dispatch(bookPathOpened({ path: "fail.zip", origin: null }));
        await store.dispatch(loadBook("fail.zip"));

        const state = store.getState().reader;
        expect(state.book).toBeNull();
        expect(state.isDirectory).toBe(false);
        expect(state.isNovel).toBe(false);
      });

      // Verify that a failed open clears a pending "last page" position so it does not
      // leak into the next opened container.
      it("should clear pendingInitialPosition when opening fails", async () => {
        vi.mocked(api.openBook).mockRejectedValue("boom");

        store.dispatch(bookPathOpened({ path: "fail.zip", origin: null, initialPosition: "last" }));
        await store.dispatch(loadBook("fail.zip"));

        expect(store.getState().reader.pendingInitialPosition).toBeNull();
      });

      it("a superseded open fails silently", async () => {
        let failOpen: (reason: unknown) => void = () => {};
        vi.mocked(api.openBook).mockReturnValueOnce(
          new Promise((_, reject) => {
            failOpen = reject;
          }),
        );
        store.dispatch(bookPathOpened({ path: "a.zip", origin: null }));
        const first = store.dispatch(loadBook("a.zip"));
        store.dispatch(bookPathOpened({ path: "b.zip", origin: null }));

        failOpen(new CommandError(ErrorCode.pathNotFound, "gone"));
        await first;

        expect(store.getState().errorNotification.pending).toEqual([]);
      });

      it("reports a failed open of the current book", async () => {
        vi.mocked(api.openBook).mockRejectedValue(new CommandError(ErrorCode.pathNotFound, "gone"));
        store.dispatch(bookPathOpened({ path: "a.zip", origin: null }));

        await store.dispatch(loadBook("a.zip"));

        expect(store.getState().errorNotification.pending).toEqual([
          { context: "open-container", code: ErrorCode.pathNotFound },
        ]);
      });

      it("reports a book that opened but could not be recorded", async () => {
        vi.mocked(api.openBook).mockResolvedValue(
          opened({
            entries: ["p1"],
            recordError: { code: ErrorCode.database, message: "locked", details: null },
          }),
        );
        store.dispatch(bookPathOpened({ path: "/books/a.zip", origin: null }));

        await store.dispatch(loadBook("/books/a.zip"));

        expect(store.getState().reader.entries).toEqual(["p1"]);
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "record-book", code: ErrorCode.database },
        ]);
      });

      it("a superseded open's record failure is silent", async () => {
        let finishOpen: (value: Opened) => void = () => {};
        vi.mocked(api.openBook).mockReturnValueOnce(
          new Promise((resolve) => {
            finishOpen = resolve;
          }),
        );
        store.dispatch(bookPathOpened({ path: "/books/a.zip", origin: null }));
        const first = store.dispatch(loadBook("/books/a.zip"));
        store.dispatch(bookPathOpened({ path: "/books/b.zip", origin: null }));

        finishOpen(
          opened({
            entries: ["p1"],
            recordError: { code: ErrorCode.database, message: "locked", details: null },
          }),
        );
        await first;

        expect(store.getState().errorNotification.pending).toEqual([]);
      });
    });

    describe("opening a book", () => {
      const pages = (count: number) =>
        opened({
          entries: Array.from({ length: count }, (_, i) => `p${i + 1}`),
          book: createMockBookWithState({ id: 1, lastReadPageIndex: 0 }),
        });

      beforeEach(() => {
        vi.mocked(api.openBook).mockResolvedValue(pages(5));
      });

      it("openBook loads the book it opens", async () => {
        await store.dispatch(openBook({ path: "/a.zip", origin: { kind: "fileNavigator" } }));

        expect(api.openBook).toHaveBeenCalledTimes(1);
        expect(api.openBook).toHaveBeenCalledWith("/a.zip");
        const state = store.getState().reader;
        expect(state.history).toEqual(["/a.zip"]);
        expect(state.origin).toEqual({ kind: "fileNavigator" });
        expect(state.isLoading).toBe(false);
      });

      it("openBook of the open path loads nothing", async () => {
        await store.dispatch(openBook({ path: "/a.zip", origin: null }));
        store.dispatch(setImageIndex(3));

        await store.dispatch(openBook({ path: "/a.zip", origin: null }));

        expect(api.openBook).toHaveBeenCalledTimes(1);
        expect(store.getState().reader.index).toBe(3);
      });

      it('openBook with initialPosition "last" lands on the last page', async () => {
        await store.dispatch(openBook({ path: "/a.zip", origin: null, initialPosition: "last" }));

        const state = store.getState().reader;
        expect(state.index).toBe(4);
        expect(state.pendingInitialPosition).toBeNull();
      });

      it("goBackBookHistory loads the previous book", async () => {
        await store.dispatch(openBook({ path: "/a.zip", origin: null }));
        await store.dispatch(openBook({ path: "/b.zip", origin: null }));

        await store.dispatch(goBackBookHistory());

        expect(api.openBook).toHaveBeenCalledTimes(3);
        expect(api.openBook).toHaveBeenLastCalledWith("/a.zip");
        const state = store.getState().reader;
        expect(state.history[state.historyIndex]).toBe("/a.zip");
        expect(state.isLoading).toBe(false);
      });

      it("goForwardBookHistory loads the next book", async () => {
        await store.dispatch(openBook({ path: "/a.zip", origin: null }));
        await store.dispatch(openBook({ path: "/b.zip", origin: null }));
        await store.dispatch(goBackBookHistory());

        await store.dispatch(goForwardBookHistory());

        expect(api.openBook).toHaveBeenCalledTimes(4);
        expect(api.openBook).toHaveBeenLastCalledWith("/b.zip");
        const state = store.getState().reader;
        expect(state.history[state.historyIndex]).toBe("/b.zip");
        expect(state.isLoading).toBe(false);
      });

      it("goBackBookHistory at the first book loads nothing", async () => {
        await store.dispatch(openBook({ path: "/a.zip", origin: null }));

        await store.dispatch(goBackBookHistory());

        expect(api.openBook).toHaveBeenCalledTimes(1);
      });

      it("an adjacent open overtaken by another open keeps its initial position", async () => {
        vi.mocked(api.openBook).mockReturnValueOnce(new Promise(() => {}));
        void store.dispatch(
          openBook({ path: "/b.zip", origin: { kind: "history" }, initialPosition: "last" }),
        );

        await store.dispatch(openBook({ path: "/c.zip", origin: { kind: "fileNavigator" } }));

        expect(store.getState().reader.index).toBe(4);
      });

      it("a new book starts from a clean view", async () => {
        vi.mocked(api.openBook).mockResolvedValueOnce({
          ...pages(5),
          hasPreviews: true,
        });
        await store.dispatch(openBook({ path: "/a.zip", origin: null }));
        store.dispatch(setNovelLocation({ index: 2, cfi: "epubcfi(/6/2)" }));
        store.dispatch(setSpreadShifted(true));
        store.dispatch(setSpreadDisplayed(true));
        store.dispatch(setReadingDirection("ltr"));
        store.dispatch(setNovelDirection("rtl"));

        vi.mocked(api.openBook).mockReturnValueOnce(new Promise(() => {}));
        void store.dispatch(openBook({ path: "/b.zip", origin: null }));

        const state = store.getState().reader;
        expect(state.isLoading).toBe(true);
        expect(state.book).toBeNull();
        expect(state.entries).toEqual([]);
        expect(state.index).toBe(0);
        expect(state.isSpreadShifted).toBe(false);
        expect(state.isSpreadDisplayed).toBe(false);
        expect(state.readingDirection).toBeNull();
        expect(state.cfi).toBeNull();
        expect(state.novelDirection).toBeNull();
        expect(state.hasPreviews).toBe(false);
      });
    });

    describe("restoring the last book", () => {
      const storeWith = (recordReadingHistory: boolean, restoreLastBook: boolean) => {
        const preloaded = createBasePreloadedState();
        preloaded.settings.history.recordReadingHistory = recordReadingHistory;
        preloaded.settings.startup.restoreLastBook = restoreLastBook;
        return createTestStore(preloaded);
      };

      beforeEach(() => {
        vi.mocked(api.openBook).mockResolvedValue(opened({ entries: ["p1"] }));
      });

      it("restoreLastBook opens the newest book when history and restore are on", async () => {
        vi.mocked(api.getRecentlyReadBooks).mockResolvedValue([
          createMockBookWithState({ filePath: "/last/book.zip" }),
          createMockBookWithState({ filePath: "/older/book.zip" }),
        ]);
        store = storeWith(true, true);

        await store.dispatch(restoreLastBook());

        const state = store.getState().reader;
        expect(state.history).toEqual(["/last/book.zip"]);
        expect(state.origin).toEqual({ kind: "startup" });
        expect(api.openBook).toHaveBeenCalledWith("/last/book.zip");
      });

      it("restoreLastBook opens nothing when restore or history recording is off", async () => {
        for (const [recordReadingHistory, restore] of [
          [false, true],
          [true, false],
        ]) {
          store = storeWith(recordReadingHistory, restore);

          await store.dispatch(restoreLastBook());

          expect(api.getRecentlyReadBooks).not.toHaveBeenCalled();
          expect(store.getState().reader.history).toEqual([]);
        }
      });

      it("restoreLastBook opens nothing when no book was read", async () => {
        vi.mocked(api.getRecentlyReadBooks).mockResolvedValue([]);
        store = storeWith(true, true);

        await store.dispatch(restoreLastBook());

        expect(api.getRecentlyReadBooks).toHaveBeenCalledTimes(1);
        expect(store.getState().reader.history).toEqual([]);
      });
    });
  });
});
