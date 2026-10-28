import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../bindings/BookCommands";
import * as ContainerCommands from "../../bindings/ContainerCommands";
import * as DirectoryCommands from "../../bindings/DirectoryCommands";
import { createMockBookWithState } from "../../test/factories";
import { type AppStore, createTestStore, type RootState } from "../../test/utils";
import { CommandError, ErrorCode } from "../../types/Error";
import readerReducer, {
  clearContainerFileError,
  goBackContainerHistory,
  goForwardContainerHistory,
  openBook,
  openContainerFile,
  setContainerFilePath,
  setEntries,
  setImageIndex,
  setNovelDirection,
  setNovelLocation,
  setPendingInitialPosition,
  setSpreadDisplayed,
  setSpreadShifted,
  toggleReadingDirection,
  toggleSpreadShift,
} from "./slice";
import type { OpenOrigin } from "./types/OpenOrigin";

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
        let state = readerReducer(undefined, openBook({ path: "/s/v1.zip", origin: shelf }));
        state = readerReducer(state, setContainerFilePath("/other/x.zip"));
        expect(state.origin).toBeNull();
      });

      it("back and forward restore each entry's origin", () => {
        let state = readerReducer(undefined, openBook({ path: "/s/v1.zip", origin: shelf }));
        state = readerReducer(
          state,
          openBook({ path: "/d/a.zip", origin: { kind: "fileNavigator" } }),
        );
        state = readerReducer(state, goBackContainerHistory());
        expect(state.origin).toEqual(shelf);
        state = readerReducer(state, goForwardContainerHistory());
        expect(state.origin).toEqual({ kind: "fileNavigator" });
      });

      it("a new open after going back drops the forward origins", () => {
        let state = readerReducer(undefined, openBook({ path: "/a", origin: shelf }));
        state = readerReducer(state, openBook({ path: "/b", origin: null }));
        state = readerReducer(state, goBackContainerHistory());
        state = readerReducer(state, openBook({ path: "/c", origin: { kind: "history" } }));
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
    it("should clear the displayed-spread flag on setContainerFilePath", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: [],
        historyIndex: -1,
        isSpreadDisplayed: true,
      } as unknown as RootState["reader"];
      const state = readerReducer(initialState, setContainerFilePath("/books/a.zip"));
      expect(state.isSpreadDisplayed).toBe(false);
    });

    // Verify that page turns never change the pairing
    it("should leave the shifted flag untouched on setImageIndex", () => {
      const initialState = { index: 0, isSpreadShifted: true, cfi: null } as RootState["reader"];
      const state = readerReducer(initialState, setImageIndex(10));
      expect(state.isSpreadShifted).toBe(true);
    });

    // Verify that container file path is set and history is updated
    it("should handle setContainerFilePath and update history", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["old"],
        historyIndex: 0,
        index: 5,
      } as RootState["reader"];
      const state = readerReducer(initialState, setContainerFilePath("new"));
      expect(state.history).toEqual(["old", "new"]);
      expect(state.historyIndex).toBe(1);
      expect(state.index).toBe(0);
    });

    // Verify that opening another book drops the previous book's shifted pairing
    it("should reset the shifted flag in setContainerFilePath", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["old"],
        historyIndex: 0,
        index: 5,
        isSpreadShifted: true,
      } as RootState["reader"];
      const state = readerReducer(initialState, setContainerFilePath("new"));
      expect(state.isSpreadShifted).toBe(false);
    });

    // Verify that history is not updated when setContainerFilePath is called with current path
    it("should not update history if setContainerFilePath is called with current path", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["current"],
        historyIndex: 0,
      } as RootState["reader"];
      const state = readerReducer(initialState, setContainerFilePath("current"));
      expect(state.history).toHaveLength(1);
    });

    // Verify that a no-op open (same path) clears any pending initial position
    it("should clear pendingInitialPosition on a no-op setContainerFilePath", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["current"],
        historyIndex: 0,
        pendingInitialPosition: "last",
      } as RootState["reader"];
      const state = readerReducer(initialState, setContainerFilePath("current"));
      expect(state.history).toHaveLength(1);
      expect(state.pendingInitialPosition).toBeNull();
    });

    // Verify that subsequent history is sliced when a new path is set while in the middle of history
    it("should slice history in setContainerFilePath when index is not at the end", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["p1", "p2", "p3"],
        historyIndex: 1,
      } as RootState["reader"];
      const state = readerReducer(initialState, setContainerFilePath("new"));
      expect(state.history).toEqual(["p1", "p2", "new"]);
      expect(state.historyIndex).toBe(2);
    });

    // Verify that container history navigation (back/forward) works correctly
    it("should handle history navigation", () => {
      const initialState = {
        originHistory: [] as OpenOrigin[],
        history: ["p1", "p2", "p3"],
        historyIndex: 1,
      } as RootState["reader"];

      let state = readerReducer(initialState, goBackContainerHistory());
      expect(state.historyIndex).toBe(0);
      state = readerReducer(state, goBackContainerHistory()); // Should not go below 0
      expect(state.historyIndex).toBe(0);

      state = readerReducer(initialState, goForwardContainerHistory());
      expect(state.historyIndex).toBe(2);
      state = readerReducer(state, goForwardContainerHistory()); // Should not go beyond length - 1
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

    // Verify that openBook records the origin and opens the path in one step
    it("should handle openBook", () => {
      const initialState = {
        history: ["old"],
        originHistory: [null],
        historyIndex: 0,
        index: 5,
        isSpreadShifted: true,
        isSpreadDisplayed: true,
        readingDirection: "ltr",
        isLoading: false,
        origin: null,
        pendingInitialPosition: null,
      } as RootState["reader"];

      const state = readerReducer(
        initialState,
        openBook({
          path: "new",
          origin: { kind: "bookshelf", collectionId: 3, sortOrder: "name_asc" },
        }),
      );
      expect(state.origin).toEqual({
        kind: "bookshelf",
        collectionId: 3,
        sortOrder: "name_asc",
      });
      // The path is applied exactly like setContainerFilePath.
      expect(state.history).toEqual(["old", "new"]);
      expect(state.historyIndex).toBe(1);
      expect(state.index).toBe(0);
      expect(state.isSpreadShifted).toBe(false);
      expect(state.isSpreadDisplayed).toBe(false);
      expect(state.readingDirection).toBeNull();
      expect(state.isLoading).toBe(true);

      const cleared = readerReducer(state, openBook({ path: "other", origin: null }));
      expect(cleared.origin).toBeNull();
    });

    it("should record the origin but keep the view on a no-op openBook", () => {
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
        openBook({ path: "current", origin: { kind: "dragDrop" } }),
      );
      expect(state.origin).toEqual({ kind: "dragDrop" });
      expect(state.history).toEqual(["current"]);
      expect(state.index).toBe(7);
      expect(state.isLoading).toBe(false);
      // The same-path guard still drops a stale pending position.
      expect(state.pendingInitialPosition).toBeNull();
    });

    // Verify that the pending initial position is set and cleared correctly
    it("should handle setPendingInitialPosition", () => {
      const initialState = { pendingInitialPosition: null } as RootState["reader"];

      const state = readerReducer(initialState, setPendingInitialPosition("last"));
      expect(state.pendingInitialPosition).toBe("last");

      const cleared = readerReducer(state, setPendingInitialPosition(null));
      expect(cleared.pendingInitialPosition).toBeNull();
    });

    // Verify that the container error state is cleared correctly
    it("should handle clear errors", () => {
      const initialState = { error: { code: ErrorCode.other } } as RootState["reader"];

      const state = readerReducer(initialState, clearContainerFileError());
      expect(state.error).toBeNull();
    });
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify that the previous book's detected direction cannot survive into the next one
    it("should clear novelDirection when a container starts opening", () => {
      const initialState = { novelDirection: "rtl" } as RootState["reader"];

      const state = readerReducer(
        initialState,
        openContainerFile.pending("requestId", "/path/to/book.epub"),
      );
      expect(state.novelDirection).toBeNull();
    });

    // The previous book must not receive the next book's progress or bookmarks while it opens
    it("should forget the previous book when an open starts", () => {
      const state = readerReducer(
        { book: createMockBookWithState({ id: 1 }) } as RootState["reader"],
        openContainerFile.pending("requestId", "/b.zip"),
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
        openContainerFile.rejected(new Error(), "requestId", "arg", undefined),
      );
      expect(state.novelDirection).toBeNull();
    });

    // Verify error handling for rejected actions with undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const mockState = {
        // History head matches the rejected action's meta.arg ("arg") so the
        // staleness guard lets the rejection through.
        error: null,
        history: ["arg"],
        historyIndex: 0,
      } as RootState["reader"];

      const state = readerReducer(
        mockState,
        openContainerFile.rejected(new Error(), "requestId", "arg", undefined),
      );
      expect(state.error).toBeNull();
    });

    describe("openContainerFile thunk", () => {
      // Verify that container is opened and state is updated on success
      it("should open container and update state on success", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 1 });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        expect(BookCommands.recordBookOpened).toHaveBeenCalledWith("path/to/book.zip");
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
        vi.mocked(ContainerCommands.openContainer).mockResolvedValueOnce({
          is_directory: false,
          entries: ["0000"],
          is_novel: false,
          has_previews: true,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(
          createMockBookWithState({ id: 1 }),
        );

        store.dispatch(setContainerFilePath("path/to/book.pdf"));
        await store.dispatch(openContainerFile("path/to/book.pdf"));
        expect(store.getState().reader.hasPreviews).toBe(true);

        vi.mocked(ContainerCommands.openContainer).mockReturnValueOnce(new Promise(() => {}));
        store.dispatch(setContainerFilePath("path/to/other.zip"));
        void store.dispatch(openContainerFile("path/to/other.zip"));
        expect(store.getState().reader.hasPreviews).toBe(false);
      });

      // Verify that a book which opened stays on screen when the library cannot record it
      it("keeps the pages when recording the opened book fails", async () => {
        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockRejectedValue(
          new CommandError(ErrorCode.database, "database is locked"),
        );

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        const result = await store.dispatch(openContainerFile("path/to/book.zip"));

        // It used to reject, which emptied the reader and claimed the book itself
        // could not be opened.
        expect(result.type).toBe("reader/openContainerFile/fulfilled");
        const state = store.getState().reader;
        expect(state.entries).toEqual(["p1", "p2"]);
        expect(state.book).toBeNull();
        expect(state.error).toBeNull();
        expect(state.bookRecordError).toEqual({
          code: ErrorCode.database,
          message: "database is locked",
        });
      });

      // The open-time window is the one that races the viewer's first request: it must
      // leave the pages the viewer is about to ask for to the viewer.
      it("leaves the pages the viewer will load out of the opening window", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 4 });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3", "p4", "p5", "p6"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        await store.dispatch(openContainerFile("path/to/book.zip"));

        // The test store's default reader shows spreads, so the viewer will ask for two.
        expect(ContainerCommands.requestPreloadAround).toHaveBeenCalledWith(
          "path/to/book.zip",
          4,
          store.getState().settings.reader.comic.cache.preloadPageCount,
          2,
        );
      });

      // Verify the reader's own correction comes back with the book
      it("restores the spread shift from the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, is_spread_shifted: true });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        // It used to be inferred from whether the restored page happened to be a spread
        // boundary, which made where the reader stopped decide how the book pairs.
        expect(store.getState().reader.isSpreadShifted).toBe(true);
      });

      // Verify the toggle both applies and persists
      it("toggleSpreadShift flips the flag and stores it against the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, is_spread_shifted: false });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        await store.dispatch(toggleSpreadShift());

        expect(store.getState().reader.isSpreadShifted).toBe(true);
        expect(BookCommands.updateSpreadShift).toHaveBeenCalledWith(7, true);
      });

      // Verify a book that could not be recorded still pairs as the reader asked
      it("toggleSpreadShift still applies when there is no book to store it against", async () => {
        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockRejectedValue(new Error("not recorded"));

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        await store.dispatch(toggleSpreadShift());

        expect(store.getState().reader.isSpreadShifted).toBe(true);
        expect(BookCommands.updateSpreadShift).not.toHaveBeenCalled();
      });

      // The backend seeds a new comic's direction; when it recorded none (the settings
      // could not be read), the reader falls back to its default without storing one.
      it("leaves the direction to the reader's default when the backend recorded none", async () => {
        const mockBook = createMockBookWithState({ id: 7, reading_direction: null });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        expect(store.getState().reader.readingDirection).toBeNull();
        expect(BookCommands.updateReadingDirection).not.toHaveBeenCalled();
      });

      // Verify the direction comes from the book, not the default, and is not rewritten
      it("uses the direction the backend recorded for the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, reading_direction: "ltr" });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        expect(store.getState().reader.readingDirection).toBe("ltr");
        expect(BookCommands.updateReadingDirection).not.toHaveBeenCalled();
      });

      // A novel's direction is the EPUB's own, so nothing is seeded against it
      it("leaves a novel's reading direction unset", async () => {
        const mockBook = createMockBookWithState({ id: 7, reading_direction: "rtl" });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["Chapter 1"],
          is_novel: true,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.epub"));
        await store.dispatch(openContainerFile("path/to/book.epub"));

        expect(store.getState().reader.readingDirection).toBeNull();
        expect(BookCommands.updateReadingDirection).not.toHaveBeenCalled();
      });

      // Verify the toggle both applies and persists, against the book alone
      it("toggleReadingDirection flips the direction and stores it against the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, reading_direction: "rtl" });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        await store.dispatch(toggleReadingDirection());

        expect(store.getState().reader.readingDirection).toBe("ltr");
        expect(BookCommands.updateReadingDirection).toHaveBeenCalledWith(7, "ltr");
        // The default is the seed for new books only; flipping one book must not move it.
        expect(store.getState().settings.reader.comic.readingDirection).toBe("rtl");
      });

      // Verify that the container opens on its last page when pendingInitialPosition is "last"
      it("should open on the last page when pendingInitialPosition is 'last'", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 5 });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        store.dispatch(setPendingInitialPosition("last"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().reader;
        // Last page index (entries.length - 1), not last_read_page_index.
        expect(state.index).toBe(2);
        expect(state.pendingInitialPosition).toBeNull();
      });

      // Verify that the container opens on its first page when pendingInitialPosition is "first"
      it("should open on the first page when pendingInitialPosition is 'first'", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 5 });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        store.dispatch(setPendingInitialPosition("first"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().reader;
        // First page (index 0), not last_read_page_index.
        expect(state.index).toBe(0);
        expect(state.pendingInitialPosition).toBeNull();
      });

      // Verify that a stale last_read_page_index past the page count is clamped to the last page
      it("should clamp a restored index past the page count to the last page", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 10 });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().reader;
        // Restored index 10 is clamped to entries.length - 1 (2), not left out of range.
        expect(state.index).toBe(2);
      });

      // Verify that a novel's persisted CFI is restored on open
      it("should restore the persisted CFI when opening an EPUB novel", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          last_read_page_index: 3,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["s1", "s2", "s3", "s4"],
          is_novel: true,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path.epub"));
        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().reader;
        expect(state.index).toBe(3);
        expect(state.cfi).toBe("epubcfi(/6/8!/4/2/1:0)");
      });

      // Verify that a comic never restores a CFI, even if the row carries a stale one
      it("should keep cfi null when opening a comic", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          last_read_page_index: 1,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        expect(store.getState().reader.cfi).toBeNull();
      });

      // Verify that adjacent-book "first"/"last" overrides win over the CFI restore
      it("should not restore the CFI when pendingInitialPosition is set", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          last_read_page_index: 3,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["s1", "s2", "s3"],
          is_novel: true,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path.epub"));
        store.dispatch(setPendingInitialPosition("first"));
        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().reader;
        expect(state.index).toBe(0);
        expect(state.cfi).toBeNull();
      });

      // Verify handling of EPUB novel format
      it("should handle EPUB novel", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 0 });
        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: true,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path.epub"));
        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().reader;
        expect(state.isNovel).toBe(true);
        expect(ContainerCommands.openContainer).toHaveBeenCalled();
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
          error: null,
          pendingInitialPosition: null,
        } as unknown as RootState["reader"];

        // A slow open for the previous book "old.zip" finally resolves.
        const staleAction = openContainerFile.fulfilled(
          {
            entries: ["o1", "o2", "o3"],
            isDirectory: false,
            isNovel: false,
            hasPreviews: false,
            book: createMockBookWithState({ id: 1 }),
            readingDirection: "rtl",
            bookRecordError: null,
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
        store.dispatch(setContainerFilePath(""));
        await store.dispatch(openContainerFile(""));

        const state = store.getState().reader;
        expect(state.isLoading).toBe(false);
        expect(state.error?.code).toBe(ErrorCode.path);
      });

      // Verify handling of CommandError during opening
      it("should handle CommandError during open", async () => {
        const mockError = new CommandError(ErrorCode.other, "cmd failed");
        vi.mocked(ContainerCommands.openContainer).mockRejectedValue(mockError);

        store.dispatch(setContainerFilePath("fail.zip"));
        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().reader;
        expect(state.error?.code).toBe(ErrorCode.other);
        expect(state.error?.message).toContain("cmd failed");
      });
    });

    describe("openContainerFile thunk error cases", () => {
      // Verify handling of generic error during container open
      it("should handle generic error during container open", async () => {
        const testError = "open failed";
        vi.mocked(ContainerCommands.openContainer).mockRejectedValue(testError);

        store.dispatch(setContainerFilePath("fail.zip"));
        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().reader;
        expect(state.isLoading).toBe(false);
        expect(state.error?.message).toContain(testError);
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
        view.setUint8(0, 1); // is_directory = true
        view.setUint32(1, nameBuffer.byteLength);
        new Uint8Array(buffer).set(nameBuffer, 5);
        view.setBigUint64(5 + nameBuffer.byteLength, BigInt(0));

        vi.mocked(ContainerCommands.openContainer).mockRejectedValue(
          new CommandError(ErrorCode.emptyContainer, "Empty Container Error: multi.zip"),
        );
        vi.mocked(DirectoryCommands.getEntriesInDir).mockResolvedValue(buffer);

        store.dispatch(setContainerFilePath("multi.zip"));
        await store.dispatch(openContainerFile("multi.zip"));

        const { fileNavigator, reader } = store.getState();
        expect(fileNavigator.history[fileNavigator.historyIndex]).toBe("multi.zip");
        expect(fileNavigator.entries.map((entry) => entry.name)).toEqual(["ch1"]);
        // The reader sits on the dropped path with no pages, not on the previous book.
        expect(reader.history[reader.historyIndex]).toBe("multi.zip");
        expect(reader.entries).toEqual([]);
      });

      // A slow failure must not drag the navigator away from a book opened after it.
      it("should not move the file navigator when another book was opened meanwhile", async () => {
        vi.mocked(ContainerCommands.openContainer).mockRejectedValue(
          new CommandError(ErrorCode.emptyContainer, "Empty Container Error: stale.zip"),
        );

        // `stale.zip` is no longer the head of the container history.
        store.dispatch(setContainerFilePath("current.zip"));
        await store.dispatch(openContainerFile("stale.zip"));

        expect(DirectoryCommands.getEntriesInDir).not.toHaveBeenCalled();
      });

      // Other failures leave the navigator alone: there is no path worth entering.
      it("should not move the file navigator for a failure other than an empty container", async () => {
        vi.mocked(ContainerCommands.openContainer).mockRejectedValue(
          new CommandError(ErrorCode.zip, "Zip Error: corrupt"),
        );

        store.dispatch(setContainerFilePath("broken.zip"));
        await store.dispatch(openContainerFile("broken.zip"));

        expect(DirectoryCommands.getEntriesInDir).not.toHaveBeenCalled();
      });

      // A failed open must not leave the previous book's title, type or reading state
      // on screen.
      it("should clear the previously opened book when opening fails", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 1 });
        vi.mocked(ContainerCommands.openContainer).mockResolvedValue({
          is_directory: true,
          entries: ["p1", "p2"],
          is_novel: true,
          has_previews: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("good.zip"));
        await store.dispatch(openContainerFile("good.zip"));
        expect(store.getState().reader.book).not.toBeNull();

        vi.mocked(ContainerCommands.openContainer).mockRejectedValue("boom");
        store.dispatch(setContainerFilePath("fail.zip"));
        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().reader;
        expect(state.book).toBeNull();
        expect(state.isDirectory).toBe(false);
        expect(state.isNovel).toBe(false);
      });

      // Verify that a failed open clears a pending "last page" position so it does not
      // leak into the next opened container.
      it("should clear pendingInitialPosition when opening fails", async () => {
        vi.mocked(ContainerCommands.openContainer).mockRejectedValue("boom");

        store.dispatch(setContainerFilePath("fail.zip"));
        store.dispatch(setPendingInitialPosition("last"));
        await store.dispatch(openContainerFile("fail.zip"));

        expect(store.getState().reader.pendingInitialPosition).toBeNull();
      });
    });
  });
});
