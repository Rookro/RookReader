import { describe, it, expect, vi, beforeEach } from "vitest";
import readReducer, {
  openContainerFile,
  updateExploreBasePath,
  setImageIndex,
  setContainerFilePath,
  setExploreBasePath,
  setSearchText,
  setSortOrder,
  setIsWatchEnabled,
  goBackContainerHistory,
  goForwardContainerHistory,
  goBackExplorerHistory,
  goForwardExplorerHistory,
  setNovelLocation,
  clearContainerFileError,
  clearExplorerError,
  setIsDirEntriesLoading,
  setEntries,
} from "./ReadReducer";
import { createTestStore, AppStore } from "../test/utils";
import * as BookCommands from "../bindings/BookCommands";
import * as ContainerCommands from "../bindings/ContainerCommands";
import * as DirectoryCommands from "../bindings/DirectoryCommands";
import { CommandError, ErrorCode } from "../types/Error";
import { RootState } from "../test/utils";
import { createMockBookWithState } from "../test/factories";
import { DirEntry } from "../types/DirEntry";

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

    // Verify that history is not updated when setContainerFilePath is called with current path
    it("should not update history if setContainerFilePath is called with current path", () => {
      const initialState = {
        containerFile: { history: ["current"], historyIndex: 0 },
      } as RootState["read"];
      const state = readReducer(initialState, setContainerFilePath("current"));
      expect(state.containerFile.history).toHaveLength(1);
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

    // Verify that explorer state (search text, sort order, watch setting, loading flag) is updated correctly
    it("should handle explorer state (searchText, sortOrder, watch, loading)", () => {
      const initialState = {
        explorer: {
          searchText: "",
          sortOrder: "NAME_ASC",
          isWatchEnabled: false,
          isLoading: false,
        },
      } as RootState["read"];

      let state = readReducer(initialState, setSearchText("query"));
      expect(state.explorer.searchText).toBe("query");

      state = readReducer(state, setSortOrder("DATE_DESC"));
      expect(state.explorer.sortOrder).toBe("DATE_DESC");

      state = readReducer(state, setIsWatchEnabled(true));
      expect(state.explorer.isWatchEnabled).toBe(true);

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

    // Verify that container and explorer error states are cleared correctly
    it("should handle clear errors", () => {
      const initialState = {
        containerFile: { error: { code: ErrorCode.OTHER_ERROR } },
        explorer: { error: { code: ErrorCode.OTHER_ERROR } },
      } as RootState["read"];

      let state = readReducer(initialState, clearContainerFileError());
      expect(state.containerFile.error).toBeNull();

      state = readReducer(initialState, clearExplorerError());
      expect(state.explorer.error).toBeNull();
    });
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify error handling for rejected actions with undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const mockState = {
        containerFile: { error: null },
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
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 5 });

        vi.mocked(ContainerCommands.determineEpubNovel).mockResolvedValue(false);
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["p1", "p2"],
        });
        vi.mocked(BookCommands.upsertReadBook).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        await store.dispatch(openContainerFile("path/to/book.zip"));

        const state = store.getState().read;
        expect(state.containerFile.isLoading).toBe(false);
        expect(state.containerFile.book).toEqual(mockBook);
        expect(state.containerFile.index).toBe(5);
        expect(state.containerFile.entries).toEqual(["p1", "p2"]);
      });

      // Verify handling of EPUB novel format
      it("should handle EPUB novel", async () => {
        const mockBook = createMockBookWithState({ id: 1, last_read_page_index: 0 });
        vi.mocked(ContainerCommands.determineEpubNovel).mockResolvedValue(true);
        vi.mocked(BookCommands.upsertReadBook).mockResolvedValue(1);
        vi.mocked(BookCommands.getBookWithStateById).mockResolvedValue(mockBook);

        await store.dispatch(openContainerFile("path.epub"));

        const state = store.getState().read;
        expect(state.containerFile.isNovel).toBe(true);
        expect(ContainerCommands.getEntriesInContainer).not.toHaveBeenCalled();
      });

      // Verify error handling when path is empty
      it("should handle error when path is empty", async () => {
        await store.dispatch(openContainerFile(""));

        const state = store.getState().read;
        expect(state.containerFile.isLoading).toBe(false);
        expect(state.containerFile.error?.code).toBe(ErrorCode.PATH_ERROR);
      });

      // Verify handling of CommandError during opening
      it("should handle CommandError during open", async () => {
        const mockError = new CommandError(ErrorCode.OTHER_ERROR, "cmd failed");
        vi.mocked(ContainerCommands.determineEpubNovel).mockRejectedValue(mockError);

        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().read;
        expect(state.containerFile.error?.code).toBe(ErrorCode.OTHER_ERROR);
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
        expect(state.explorer.error?.code).toBe(ErrorCode.PATH_ERROR);
      });

      // Verify handling of CommandError during explorer update
      it("should handle CommandError during explorer update", async () => {
        const mockError = new CommandError(ErrorCode.OTHER_ERROR, "dir failed");
        vi.mocked(DirectoryCommands.getEntriesInDir).mockRejectedValue(mockError);

        await store.dispatch(updateExploreBasePath({ dirPath: "/error/dir", forceUpdate: true }));

        const state = store.getState().read;
        expect(state.explorer.error?.code).toBe(ErrorCode.OTHER_ERROR);
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
        vi.mocked(ContainerCommands.determineEpubNovel).mockRejectedValue(testError);

        await store.dispatch(openContainerFile("fail.zip"));

        const state = store.getState().read;
        expect(state.containerFile.isLoading).toBe(false);
        expect(state.containerFile.error?.message).toContain(testError);
      });
    });
  });
});
