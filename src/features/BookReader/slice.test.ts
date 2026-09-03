import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../bindings/BookCommands";
import * as ContainerCommands from "../../bindings/ContainerCommands";
import * as DirectoryCommands from "../../bindings/DirectoryCommands";
import { createMockBookWithState } from "../../test/factories";
import { type AppStore, createTestStore, type RootState } from "../../test/utils";
import type { DirEntry } from "../../types/DirEntry";
import { CommandError, ErrorCode } from "../../types/Error";
import readReducer, {
  clearContainerFileError,
  clearExplorerError,
  goBackContainerHistory,
  goBackExplorerHistory,
  goForwardContainerHistory,
  goForwardExplorerHistory,
  openContainerFile,
  setContainerFilePath,
  setEntries,
  setExploreBasePath,
  setImageIndex,
  setIsDirEntriesLoading,
  setNovelDirection,
  setNovelLocation,
  setOpenOrigin,
  setPendingInitialPosition,
  setSearchText,
  setSpreadDisplayed,
  setSpreadShifted,
  toggleSpreadShift,
  updateExploreBasePath,
} from "./slice";

describe("ReadReducer", () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  describe("reducers", () => {
    // Verify that initial state is set correctly
    it("should handle initial state", () => {
      expect(readReducer(undefined, { type: "unknown" })).toBeDefined();
    });

    // Verify that image index is set correctly and CFI is cleared
    it("should handle setImageIndex", () => {
      const initialState = {
        containerFile: { index: 0, cfi: "old-cfi" },
      } as RootState["read"];
      const state = readReducer(initialState, setImageIndex(10));
      expect(state.containerFile.index).toBe(10);
      expect(state.containerFile.cfi).toBeNull();
    });

    // Verify that the shifted flag is stored as given
    it("should handle setSpreadShifted", () => {
      const initialState = {
        containerFile: { isSpreadShifted: false },
      } as RootState["read"];
      const state = readReducer(initialState, setSpreadShifted(true));
      expect(state.containerFile.isSpreadShifted).toBe(true);
    });

    // Verify that the displayed-spread flag is stored as given
    it("should handle setSpreadDisplayed", () => {
      const initialState = {
        containerFile: { isSpreadDisplayed: false },
      } as RootState["read"];
      const state = readReducer(initialState, setSpreadDisplayed(true));
      expect(state.containerFile.isSpreadDisplayed).toBe(true);
    });

    // Verify that opening another book never leaves a stale spread flag behind
    it("should clear the displayed-spread flag on setContainerFilePath", () => {
      const initialState = {
        containerFile: { history: [], historyIndex: -1, isSpreadDisplayed: true },
      } as unknown as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("/books/a.zip"));
      expect(state.containerFile.isSpreadDisplayed).toBe(false);
    });

    // Verify that page turns never change the pairing
    it("should leave the shifted flag untouched on setImageIndex", () => {
      const initialState = {
        containerFile: { index: 0, isSpreadShifted: true, cfi: null },
      } as RootState["read"];
      const state = readReducer(initialState, setImageIndex(10));
      expect(state.containerFile.isSpreadShifted).toBe(true);
    });

    // Verify that container file path is set and history is updated
    it("should handle setContainerFilePath and update history", () => {
      const initialState = {
        containerFile: { history: ["old"], historyIndex: 0, index: 5 },
      } as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("new"));
      expect(state.containerFile.history).toEqual(["old", "new"]);
      expect(state.containerFile.historyIndex).toBe(1);
      expect(state.containerFile.index).toBe(0);
    });

    // Verify that opening another book drops the previous book's shifted pairing
    it("should reset the shifted flag in setContainerFilePath", () => {
      const initialState = {
        containerFile: { history: ["old"], historyIndex: 0, index: 5, isSpreadShifted: true },
      } as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("new"));
      expect(state.containerFile.isSpreadShifted).toBe(false);
    });

    // Verify that history is not updated when setContainerFilePath is called with current path
    it("should not update history if setContainerFilePath is called with current path", () => {
      const initialState = {
        containerFile: { history: ["current"], historyIndex: 0 },
      } as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("current"));
      expect(state.containerFile.history).toHaveLength(1);
    });

    // Verify that a no-op open (same path) clears any pending initial position
    it("should clear pendingInitialPosition on a no-op setContainerFilePath", () => {
      const initialState = {
        containerFile: { history: ["current"], historyIndex: 0, pendingInitialPosition: "last" },
      } as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("current"));
      expect(state.containerFile.history).toHaveLength(1);
      expect(state.containerFile.pendingInitialPosition).toBeNull();
    });

    // Verify that subsequent history is sliced when a new path is set while in the middle of history
    it("should slice history in setContainerFilePath when index is not at the end", () => {
      const initialState = {
        containerFile: { history: ["p1", "p2", "p3"], historyIndex: 1 },
      } as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("new"));
      expect(state.containerFile.history).toEqual(["p1", "p2", "new"]);
      expect(state.containerFile.historyIndex).toBe(2);
    });

    // Verify that explorer base path is set and history is updated
    it("should handle setExploreBasePath and update history", () => {
      const initialState = {
        explorer: { history: ["/old"], historyIndex: 0 },
      } as RootState["read"];
      const state = readReducer(initialState, setExploreBasePath("/new"));
      expect(state.explorer.history).toEqual(["/old", "/new"]);
      expect(state.explorer.historyIndex).toBe(1);
    });

    // Verify that history is not updated when setExploreBasePath is called with current path
    it("should not update history if setExploreBasePath is called with current path", () => {
      const initialState = {
        explorer: { history: ["/current"], historyIndex: 0 },
      } as RootState["read"];
      const state = readReducer(initialState, setExploreBasePath("/current"));
      expect(state.explorer.history).toHaveLength(1);
    });

    // Verify that subsequent history is sliced when a new explorer path is set while in the middle of history
    it("should slice history in setExploreBasePath when index is not at the end", () => {
      const initialState = {
        explorer: { history: ["/d1", "/d2", "/d3"], historyIndex: 1 },
      } as RootState["read"];
      const state = readReducer(initialState, setExploreBasePath("/new"));
      expect(state.explorer.history).toEqual(["/d1", "/d2", "/new"]);
      expect(state.explorer.historyIndex).toBe(2);
    });

    // Verify that container and explorer history navigation (back/forward) works correctly
    it("should handle history navigation", () => {
      const initialState = {
        containerFile: { history: ["p1", "p2", "p3"], historyIndex: 1 },
        explorer: { history: ["d1", "d2", "d3"], historyIndex: 1 },
      } as RootState["read"];

      let state = readReducer(initialState, goBackContainerHistory());
      expect(state.containerFile.historyIndex).toBe(0);
      state = readReducer(state, goBackContainerHistory()); // Should not go below 0
      expect(state.containerFile.historyIndex).toBe(0);

      state = readReducer(initialState, goForwardContainerHistory());
      expect(state.containerFile.historyIndex).toBe(2);
      state = readReducer(state, goForwardContainerHistory()); // Should not go beyond length - 1
      expect(state.containerFile.historyIndex).toBe(2);

      state = readReducer(initialState, goBackExplorerHistory());
      expect(state.explorer.historyIndex).toBe(0);
      state = readReducer(state, goBackExplorerHistory());
      expect(state.explorer.historyIndex).toBe(0);

      state = readReducer(initialState, goForwardExplorerHistory());
      expect(state.explorer.historyIndex).toBe(2);
      state = readReducer(state, goForwardExplorerHistory());
      expect(state.explorer.historyIndex).toBe(2);
    });

    // Verify that explorer state (search text, loading flag) is updated correctly
    it("should handle explorer state (searchText, loading)", () => {
      const initialState = {
        explorer: {
          searchText: "",
          isLoading: false,
        },
      } as RootState["read"];

      let state = readReducer(initialState, setSearchText("query"));
      expect(state.explorer.searchText).toBe("query");

      state = readReducer(state, setIsDirEntriesLoading(true));
      expect(state.explorer.isLoading).toBe(true);
    });

    // Verify that entry list is set correctly
    it("should handle setEntries", () => {
      const initialState = {
        containerFile: { entries: [] as string[] },
      } as RootState["read"];
      const state = readReducer(initialState, setEntries(["e1", "e2"]));
      expect(state.containerFile.entries).toEqual(["e1", "e2"]);
    });

    // Verify that novel location (index and CFI) is set correctly
    it("should handle setNovelLocation", () => {
      const initialState = {
        containerFile: { index: 0, cfi: null },
      } as RootState["read"];
      const state = readReducer(initialState, setNovelLocation({ index: 5, cfi: "epub-cfi" }));
      expect(state.containerFile.index).toBe(5);
      expect(state.containerFile.cfi).toBe("epub-cfi");
    });

    // Verify that the detected novel direction is stored as given
    it("should handle setNovelDirection", () => {
      const initialState = {
        containerFile: { novelDirection: null },
      } as RootState["read"];
      const state = readReducer(initialState, setNovelDirection("rtl"));
      expect(state.containerFile.novelDirection).toBe("rtl");
    });

    // Verify that the open origin is set and cleared correctly
    it("should handle setOpenOrigin", () => {
      const initialState = {
        containerFile: { origin: null },
      } as RootState["read"];

      const state = readReducer(
        initialState,
        setOpenOrigin({ kind: "bookshelf", bookshelfId: 3, sortOrder: "name_asc" }),
      );
      expect(state.containerFile.origin).toEqual({
        kind: "bookshelf",
        bookshelfId: 3,
        sortOrder: "name_asc",
      });

      const cleared = readReducer(state, setOpenOrigin(null));
      expect(cleared.containerFile.origin).toBeNull();
    });

    // Verify that the pending initial position is set and cleared correctly
    it("should handle setPendingInitialPosition", () => {
      const initialState = {
        containerFile: { pendingInitialPosition: null },
      } as RootState["read"];

      const state = readReducer(initialState, setPendingInitialPosition("last"));
      expect(state.containerFile.pendingInitialPosition).toBe("last");

      const cleared = readReducer(state, setPendingInitialPosition(null));
      expect(cleared.containerFile.pendingInitialPosition).toBeNull();
    });

    // Verify that container and explorer error states are cleared correctly
    it("should handle clear errors", () => {
      const initialState = {
        containerFile: { error: { code: ErrorCode.other } },
        explorer: { error: { code: ErrorCode.other } },
      } as RootState["read"];

      let state = readReducer(initialState, clearContainerFileError());
      expect(state.containerFile.error).toBeNull();

      state = readReducer(initialState, clearExplorerError());
      expect(state.explorer.error).toBeNull();
    });
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify that the previous book's detected direction cannot survive into the next one
    it("should clear novelDirection when a container starts opening", () => {
      const initialState = {
        containerFile: { novelDirection: "rtl" },
      } as RootState["read"];

      const state = readReducer(
        initialState,
        openContainerFile.pending("requestId", "/path/to/book.epub"),
      );
      expect(state.containerFile.novelDirection).toBeNull();
    });

    // Verify that a failed open leaves no direction behind, like the other book state
    it("should clear novelDirection when opening fails", () => {
      const initialState = {
        containerFile: { novelDirection: "rtl", history: ["arg"], historyIndex: 0 },
      } as RootState["read"];

      const state = readReducer(
        initialState,
        openContainerFile.rejected(new Error(), "requestId", "arg", undefined),
      );
      expect(state.containerFile.novelDirection).toBeNull();
    });

    // Verify error handling for rejected actions with undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const mockState = {
        // History head matches the rejected action's meta.arg ("arg") so the
        // staleness guard lets the rejection through.
        containerFile: { error: null, history: ["arg"], historyIndex: 0 },
        explorer: { error: null },
      } as RootState["read"];

      let state = readReducer(
        mockState,
        openContainerFile.rejected(new Error(), "requestId", "arg", undefined),
      );
      expect(state.containerFile.error).toBeNull();

      state = readReducer(
        mockState,
        updateExploreBasePath.rejected(new Error(), "requestId", { dirPath: "arg" }, undefined),
      );
      expect(state.explorer.error).toBeNull();
    });

    describe("openContainerFile thunk", () => {
      // Verify that container is opened and state is updated on success
      it("should open container and update state on success", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 1 });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().read;
        expect(state.containerFile.isLoading).toBe(false);
        expect(state.containerFile.book).toEqual(mockBook);
        expect(state.containerFile.index).toBe(1);
        expect(state.containerFile.entries).toEqual(["p1", "p2"]);
        // The book carries no correction, so the pairing is the one it measures.
        expect(state.containerFile.isSpreadShifted).toBe(false);
      });

      // The open-time window is the one that races the viewer's first request: it must
      // leave the pages the viewer is about to ask for to the viewer.
      it("leaves the pages the viewer will load out of the opening window", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 4 });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3", "p4", "p5", "p6"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

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

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(7);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        // It used to be inferred from whether the restored page happened to be a spread
        // boundary, which made where the reader stopped decide how the book pairs.
        expect(store.getState().read.containerFile.isSpreadShifted).toBe(true);
      });

      // Verify the toggle both applies and persists
      it("toggleSpreadShift flips the flag and stores it against the book", async () => {
        const mockBook = createMockBookWithState({ id: 7, is_spread_shifted: false });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(7);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        await store.dispatch(toggleSpreadShift());

        expect(store.getState().read.containerFile.isSpreadShifted).toBe(true);
        expect(BookCommands.updateSpreadShift).toHaveBeenCalledWith(7, true);
      });

      // Verify a book that could not be recorded still pairs as the reader asked
      it("toggleSpreadShift still applies when there is no book to store it against", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(null);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        await store.dispatch(toggleSpreadShift());

        expect(store.getState().read.containerFile.isSpreadShifted).toBe(true);
        expect(BookCommands.updateSpreadShift).not.toHaveBeenCalled();
      });

      // A folder inside an archive is stored as a folder, so the History tab shows it
      // with a folder icon like any other folder of pages.
      it("should record a folder inside an archive as a directory", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["001.png"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(
          createMockBookWithState({ id: 1 }),
        );

        store.dispatch(setContainerFilePath("/books/comic.zip/ch1"));
        await store.dispatch(openContainerFile("/books/comic.zip/ch1"));

        expect(BookCommands.recordBookOpened).toHaveBeenCalledWith(
          expect.objectContaining({ itemType: "directory" }),
        );
      });

      // Verify that the container opens on its last page when pendingInitialPosition is "last"
      it("should open on the last page when pendingInitialPosition is 'last'", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 5 });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        store.dispatch(setPendingInitialPosition("last"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().read;
        // Last page index (entries.length - 1), not last_read_page_index.
        expect(state.containerFile.index).toBe(2);
        expect(state.containerFile.pendingInitialPosition).toBeNull();
      });

      // Verify that the container opens on its first page when pendingInitialPosition is "first"
      it("should open on the first page when pendingInitialPosition is 'first'", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 5 });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        store.dispatch(setPendingInitialPosition("first"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().read;
        // First page (index 0), not last_read_page_index.
        expect(state.containerFile.index).toBe(0);
        expect(state.containerFile.pendingInitialPosition).toBeNull();
      });

      // Verify that a stale last_read_page_index past the page count is clamped to the last page
      it("should clamp a restored index past the page count to the last page", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 10 });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2", "p3"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().read;
        // Restored index 10 is clamped to entries.length - 1 (2), not left out of range.
        expect(state.containerFile.index).toBe(2);
      });

      // Verify that a novel's persisted CFI is restored on open
      it("should restore the persisted CFI when opening an EPUB novel", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          last_read_page_index: 3,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["s1", "s2", "s3", "s4"],
          is_novel: true,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path.epub"));
        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().read;
        expect(state.containerFile.index).toBe(3);
        expect(state.containerFile.cfi).toBe("epubcfi(/6/8!/4/2/1:0)");
      });

      // Verify that a comic never restores a CFI, even if the row carries a stale one
      it("should keep cfi null when opening a comic", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          last_read_page_index: 1,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: false,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path/to/book.zip"));
        await store.dispatch(openContainerFile("path/to/book.zip"));

        expect(store.getState().read.containerFile.cfi).toBeNull();
      });

      // Verify that adjacent-book "first"/"last" overrides win over the CFI restore
      it("should not restore the CFI when pendingInitialPosition is set", async () => {
        const mockBook = createMockBookWithState({
          id: 1,
          last_read_page_index: 3,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });

        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["s1", "s2", "s3"],
          is_novel: true,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path.epub"));
        store.dispatch(setPendingInitialPosition("first"));
        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().read;
        expect(state.containerFile.index).toBe(0);
        expect(state.containerFile.cfi).toBeNull();
      });

      // Verify handling of EPUB novel format
      it("should handle EPUB novel", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 0 });
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
          is_novel: true,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("path.epub"));
        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().read;
        expect(state.containerFile.isNovel).toBe(true);
        expect(ContainerCommands.getEntriesInContainer).toHaveBeenCalled();
      });

      // Verify that a stale fulfilled response (for a book the user already navigated
      // away from) does not overwrite the newer book's state.
      it("should ignore a stale fulfilled response for a superseded book", () => {
        // Current head is the newer book "new.zip" with its own loaded state.
        const initialState = {
          containerFile: {
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
          },
        } as unknown as RootState["read"];

        // A slow open for the previous book "old.zip" finally resolves.
        const staleAction = openContainerFile.fulfilled(
          {
            entries: ["o1", "o2", "o3"],
            isDirectory: false,
            isNovel: false,
            book: createMockBookWithState({ id: 1 }),
          },
          "requestId",
          "old.zip",
        );
        const state = readReducer(initialState, staleAction);

        // The newer book's state is preserved, unchanged by the stale response.
        expect(state.containerFile.entries).toEqual(["n1", "n2"]);
        expect(state.containerFile.book?.id).toBe(2);
        expect(state.containerFile.index).toBe(1);
      });

      // Verify error handling when path is empty
      it("should handle error when path is empty", async () => {
        store.dispatch(setContainerFilePath(""));
        await store.dispatch(openContainerFile(""));

        const state = store.getState().read;
        expect(state.containerFile.isLoading).toBe(false);
        expect(state.containerFile.error?.code).toBe(ErrorCode.path);
      });

      // Verify handling of CommandError during opening
      it("should handle CommandError during open", async () => {
        const mockError = new CommandError(ErrorCode.other, "cmd failed");
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(mockError);

        store.dispatch(setContainerFilePath("fail.zip"));
        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().read;
        expect(state.containerFile.error?.code).toBe(ErrorCode.other);
        expect(state.containerFile.error?.message).toContain("cmd failed");
      });
    });

    describe("updateExploreBasePath thunk", () => {
      // Verify that directory entries are updated and added to history
      it("should update entries for directory", async () => {
        // Construct binary data matching convertEntriesInDir's expectation
        const name = "file.jpg";
        const nameBuffer = new TextEncoder().encode(name);
        const buffer = new ArrayBuffer(1 + 4 + nameBuffer.byteLength + 8);
        const view = new DataView(buffer);

        view.setUint8(0, 0); // is_directory = false
        view.setUint32(1, nameBuffer.byteLength); // name length
        new Uint8Array(buffer).set(nameBuffer, 5); // name data
        view.setBigUint64(5 + nameBuffer.byteLength, BigInt(0)); // last_modified = 0

        vi.mocked(DirectoryCommands.getEntriesInDir).mockResolvedValue(buffer);

        await store.dispatch(updateExploreBasePath({ dirPath: "/test/dir", forceUpdate: true }));

        const state = store.getState().read;
        expect(state.explorer.entries[0].name).toBe("file.jpg");
        expect(state.explorer.history).toContain("/test/dir");
      });

      // Verify that update is skipped if already at the path
      it("should handle return undefined if already at the path", async () => {
        const preloadedState = {
          read: {
            explorer: { history: ["/current"], historyIndex: 0, entries: [] as DirEntry[] },
          },
        } as RootState;
        store = createTestStore(preloadedState);

        const result = await store.dispatch(updateExploreBasePath({ dirPath: "/current" }));
        expect(result.payload).toBeUndefined();
      });

      // Verify error handling when directory path is empty
      it("should handle error when directory path is empty", async () => {
        await store.dispatch(updateExploreBasePath({ dirPath: "" }));

        const state = store.getState().read;
        expect(state.explorer.error?.code).toBe(ErrorCode.path);
      });

      // Verify handling of CommandError during explorer update
      it("should handle CommandError during explorer update", async () => {
        const mockError = new CommandError(ErrorCode.other, "dir failed");
        vi.mocked(DirectoryCommands.getEntriesInDir).mockRejectedValue(mockError);

        await store.dispatch(updateExploreBasePath({ dirPath: "/error/dir", forceUpdate: true }));

        const state = store.getState().read;
        expect(state.explorer.error?.code).toBe(ErrorCode.other);
        expect(state.explorer.error?.message).toContain("dir failed");
      });

      // Verify handling of generic error during entry conversion
      it("should handle generic error during entry conversion", async () => {
        const testError = "read failed";
        vi.mocked(DirectoryCommands.getEntriesInDir).mockRejectedValue(testError);

        await store.dispatch(updateExploreBasePath({ dirPath: "/error/dir", forceUpdate: true }));

        const state = store.getState().read;
        expect(state.explorer.error?.message).toContain(testError);
      });
    });

    describe("openContainerFile thunk error cases", () => {
      // Verify handling of generic error during container open
      it("should handle generic error during container open", async () => {
        const testError = "open failed";
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(testError);

        store.dispatch(setContainerFilePath("fail.zip"));
        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().read;
        expect(state.containerFile.isLoading).toBe(false);
        expect(state.containerFile.error?.message).toContain(testError);
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

        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(
          new CommandError(ErrorCode.emptyContainer, "Empty Container Error: multi.zip"),
        );
        vi.mocked(DirectoryCommands.getEntriesInDir).mockResolvedValue(buffer);

        store.dispatch(setContainerFilePath("multi.zip"));
        await store.dispatch(openContainerFile("multi.zip"));

        const state = store.getState().read;
        expect(state.explorer.history[state.explorer.historyIndex]).toBe("multi.zip");
        expect(state.explorer.entries.map((entry) => entry.name)).toEqual(["ch1"]);
        // The reader sits on the dropped path with no pages, not on the previous book.
        expect(state.containerFile.history[state.containerFile.historyIndex]).toBe("multi.zip");
        expect(state.containerFile.entries).toEqual([]);
      });

      // A slow failure must not drag the navigator away from a book opened after it.
      it("should not move the file navigator when another book was opened meanwhile", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(
          new CommandError(ErrorCode.emptyContainer, "Empty Container Error: stale.zip"),
        );

        // `stale.zip` is no longer the head of the container history.
        store.dispatch(setContainerFilePath("current.zip"));
        await store.dispatch(openContainerFile("stale.zip"));

        expect(DirectoryCommands.getEntriesInDir).not.toHaveBeenCalled();
      });

      // Other failures leave the navigator alone: there is no path worth entering.
      it("should not move the file navigator for a failure other than an empty container", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(
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
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: true,
          entries: ["p1", "p2"],
          is_novel: true,
        });
        vi.mocked(BookCommands.recordBookOpened).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        store.dispatch(setContainerFilePath("good.zip"));
        await store.dispatch(openContainerFile("good.zip"));
        expect(store.getState().read.containerFile.book).not.toBeNull();

        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue("boom");
        store.dispatch(setContainerFilePath("fail.zip"));
        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().read;
        expect(state.containerFile.book).toBeNull();
        expect(state.containerFile.isDirectory).toBe(false);
        expect(state.containerFile.isNovel).toBe(false);
      });

      // Verify that a failed open clears a pending "last page" position so it does not
      // leak into the next opened container.
      it("should clear pendingInitialPosition when opening fails", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue("boom");

        store.dispatch(setContainerFilePath("fail.zip"));
        store.dispatch(setPendingInitialPosition("last"));
        await store.dispatch(openContainerFile("fail.zip"));

        expect(store.getState().read.containerFile.pendingInitialPosition).toBeNull();
      });
    });
  });
});
