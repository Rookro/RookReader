import { beforeEach, describe, expect, it, vi } from "vitest";
import * as binaryApi from "../../bindings/binaryApi";
import type { DirEntry } from "../../domain/entities";
import { createMockDirEntry } from "../../test/factories";
import {
  type AppStore,
  createBasePreloadedState,
  createTestStore,
  type RootState,
} from "../../test/utils";
import { CommandError, ErrorCode } from "../../types/Error";
import fileNavigatorReducer, {
  directoryPathOpened,
  goBackNavigatorHistory,
  goForwardNavigatorHistory,
  loadDirectory,
  setIsDirEntriesLoading,
  setSearchText,
} from "./fileNavigatorSlice";

describe("FileNavigatorReducer", () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(binaryApi.getEntriesInDir).mockReset();
    store = createTestStore();
  });

  describe("reducers", () => {
    // Verify that the opened directory is added to the history
    it("should handle directoryPathOpened and update history", () => {
      const initialState = { history: ["/old"], historyIndex: 0 } as RootState["fileNavigator"];
      const state = fileNavigatorReducer(initialState, directoryPathOpened("/new"));
      expect(state.history).toEqual(["/old", "/new"]);
      expect(state.historyIndex).toBe(1);
    });

    // Verify that history is not updated when directoryPathOpened is called with current path
    it("should not update history if directoryPathOpened is called with current path", () => {
      const initialState = { history: ["/current"], historyIndex: 0 } as RootState["fileNavigator"];
      const state = fileNavigatorReducer(initialState, directoryPathOpened("/current"));
      expect(state.history).toHaveLength(1);
    });

    // Verify that subsequent history is sliced when a new navigator path is set while in the middle of history
    it("should slice history in directoryPathOpened when index is not at the end", () => {
      const initialState = {
        history: ["/d1", "/d2", "/d3"],
        historyIndex: 1,
      } as RootState["fileNavigator"];
      const state = fileNavigatorReducer(initialState, directoryPathOpened("/new"));
      expect(state.history).toEqual(["/d1", "/d2", "/new"]);
      expect(state.historyIndex).toBe(2);
    });

    // Verify that File Navigator history navigation (back/forward) works correctly
    it("should handle history navigation", () => {
      const initialState = {
        history: ["d1", "d2", "d3"],
        historyIndex: 1,
      } as RootState["fileNavigator"];

      let state = fileNavigatorReducer(initialState, goBackNavigatorHistory());
      expect(state.historyIndex).toBe(0);
      state = fileNavigatorReducer(state, goBackNavigatorHistory());
      expect(state.historyIndex).toBe(0);

      state = fileNavigatorReducer(initialState, goForwardNavigatorHistory());
      expect(state.historyIndex).toBe(2);
      state = fileNavigatorReducer(state, goForwardNavigatorHistory());
      expect(state.historyIndex).toBe(2);
    });

    // Verify that File Navigator state (search text, loading flag) is updated correctly
    it("should handle File Navigator state (searchText, loading)", () => {
      const initialState = {
        searchText: "",
        isLoading: false,
      } as RootState["fileNavigator"];

      let state = fileNavigatorReducer(initialState, setSearchText("query"));
      expect(state.searchText).toBe("query");

      state = fileNavigatorReducer(state, setIsDirEntriesLoading(true));
      expect(state.isLoading).toBe(true);
    });
  });

  describe("Async Thunk Integration Tests", () => {
    describe("loadDirectory staleness", () => {
      const navigatorAt = (path: string, requestId: string) => {
        const state = structuredClone(fileNavigatorReducer(undefined, { type: "unknown" }));
        state.history = [path];
        state.historyIndex = 0;
        state.entries = [createMockDirEntry({ name: "kept" })];
        state.isLoading = true;
        state.requestId = requestId;
        return state;
      };

      // A failing folder followed by a good one: the late failure must not clear the good one
      it("ignores a failure of a superseded listing", () => {
        const state = fileNavigatorReducer(
          navigatorAt("/good", "r2"),
          loadDirectory.rejected(null, "r1", { dirPath: "/bad" }, { code: ErrorCode.io }),
        );
        expect(state.entries).toHaveLength(1);
        expect(state.isLoading).toBe(true);
      });

      it("ignores a superseded listing of the same folder", () => {
        const state = fileNavigatorReducer(
          navigatorAt("/a", "r2"),
          loadDirectory.fulfilled({ path: "/a", entries: [] }, "r1", {
            dirPath: "/a",
            forceUpdate: true,
          }),
        );
        expect(state.entries).toHaveLength(1);
        expect(state.isLoading).toBe(true);
      });

      it("tracks the folder of the latest listing until it settles", () => {
        let state = fileNavigatorReducer(
          undefined,
          loadDirectory.pending("r1", { dirPath: "/a", forceUpdate: true }),
        );
        expect(state.pendingPath).toBe("/a");
        state = fileNavigatorReducer(
          state,
          loadDirectory.pending("r2", { dirPath: "/b", forceUpdate: true }),
        );
        state = fileNavigatorReducer(
          state,
          loadDirectory.fulfilled({ path: "/a", entries: [] }, "r1", { dirPath: "/a" }),
        );
        expect(state.pendingPath).toBe("/b");
        state = fileNavigatorReducer(
          state,
          loadDirectory.rejected(null, "r2", { dirPath: "/b" }, { code: ErrorCode.io }),
        );
        expect(state.pendingPath).toBeNull();
      });

      it("tracks the folder whose listing is loaded until a matching load fails", () => {
        let state = fileNavigatorReducer(undefined, directoryPathOpened("/a"));
        expect(state.loadedPath).toBeNull();

        state = fileNavigatorReducer(state, loadDirectory.pending("r1", { dirPath: "/a" }));
        state = fileNavigatorReducer(
          state,
          loadDirectory.fulfilled({ path: "/a", entries: [] }, "r1", { dirPath: "/a" }),
        );
        expect(state.loadedPath).toBe("/a");

        state = fileNavigatorReducer(state, loadDirectory.pending("r2", { dirPath: "/a" }));
        state = fileNavigatorReducer(
          state,
          loadDirectory.rejected(null, "r2", { dirPath: "/a" }, { code: ErrorCode.io }),
        );
        expect(state.loadedPath).toBeNull();
      });

      it("keeps loadedPath when fulfilled arrives after navigating away or when superseded", () => {
        const base = structuredClone(fileNavigatorReducer(undefined, { type: "unknown" }));
        base.history = ["/a", "/b"];
        base.historyIndex = 1;
        base.entries = [createMockDirEntry({ name: "kept" })];
        base.loadedPath = "/a";
        base.requestId = "r2";
        base.isLoading = true;

        // Superseded request
        let state = fileNavigatorReducer(
          base,
          loadDirectory.fulfilled({ path: "/b", entries: [] }, "r1", { dirPath: "/b" }),
        );
        expect(state.loadedPath).toBe("/a");
        expect(state.entries).toHaveLength(1);

        // Matching requestId, but user already moved to /b while /a settled
        state = fileNavigatorReducer(
          base,
          loadDirectory.fulfilled({ path: "/a", entries: [] }, "r2", { dirPath: "/a" }),
        );
        expect(state.loadedPath).toBe("/a");
        expect(state.entries).toHaveLength(1);
        expect(state.isLoading).toBe(false);
      });

      it("keeps entries and loadedPath when rejected arrives for a different or empty path", async () => {
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = ["/a"];
        preloaded.fileNavigator.historyIndex = 0;
        preloaded.fileNavigator.entries = [createMockDirEntry({ name: "kept.zip" })];
        preloaded.fileNavigator.loadedPath = "/a";
        store = createTestStore(preloaded);

        // Empty-path rejection must not clear the current folder's listing.
        await store.dispatch(loadDirectory({ dirPath: "" }));
        expect(store.getState().fileNavigator.entries).toHaveLength(1);
        expect(store.getState().fileNavigator.loadedPath).toBe("/a");

        // Rejection for another path (e.g. after Back/Forward) must also leave /a intact.
        const afterOtherReject = fileNavigatorReducer(
          {
            ...store.getState().fileNavigator,
            requestId: "r-other",
            pendingPath: "/other",
            isLoading: true,
          },
          loadDirectory.rejected(null, "r-other", { dirPath: "/other" }, { code: ErrorCode.io }),
        );
        expect(afterOtherReject.entries).toHaveLength(1);
        expect(afterOtherReject.loadedPath).toBe("/a");
        expect(afterOtherReject.pendingPath).toBeNull();
        expect(afterOtherReject.isLoading).toBe(false);
      });

      it("dispatches nothing when the folder is already shown", async () => {
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = ["/a"];
        preloaded.fileNavigator.historyIndex = 0;
        preloaded.fileNavigator.loadedPath = "/a";
        store = createTestStore(preloaded);

        await store.dispatch(loadDirectory({ dirPath: "/a" }));

        expect(binaryApi.getEntriesInDir).not.toHaveBeenCalled();
        expect(store.getState().fileNavigator.requestId).toBeNull();
      });

      it("reloads the current folder without forceUpdate when loadedPath is null", async () => {
        vi.mocked(binaryApi.getEntriesInDir).mockResolvedValueOnce(new ArrayBuffer(0));
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = ["/a"];
        preloaded.fileNavigator.historyIndex = 0;
        preloaded.fileNavigator.loadedPath = null;
        store = createTestStore(preloaded);

        await store.dispatch(loadDirectory({ dirPath: "/a" }));

        expect(binaryApi.getEntriesInDir).toHaveBeenCalledWith("/a");
        expect(store.getState().fileNavigator.loadedPath).toBe("/a");
      });

      it("reloads the current folder without forceUpdate when another folder's background load is pending", async () => {
        vi.mocked(binaryApi.getEntriesInDir).mockResolvedValueOnce(new ArrayBuffer(0));
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = ["/a"];
        preloaded.fileNavigator.historyIndex = 0;
        preloaded.fileNavigator.loadedPath = "/a";
        preloaded.fileNavigator.pendingPath = "/b";
        preloaded.fileNavigator.isLoading = false;
        store = createTestStore(preloaded);

        await store.dispatch(loadDirectory({ dirPath: "/a" }));

        expect(binaryApi.getEntriesInDir).toHaveBeenCalledWith("/a");
        expect(store.getState().fileNavigator.pendingPath).toBeNull();
      });

      it("a superseded listing fails silently", async () => {
        let failListing: (reason: unknown) => void = () => {};
        vi.mocked(binaryApi.getEntriesInDir)
          .mockReturnValueOnce(
            new Promise((_, reject) => {
              failListing = reject;
            }),
          )
          .mockResolvedValueOnce(new ArrayBuffer(0));
        const first = store.dispatch(loadDirectory({ dirPath: "/a" }));
        await store.dispatch(loadDirectory({ dirPath: "/b" }));

        failListing(new CommandError(ErrorCode.io, "unreadable"));
        expect((await first).payload).toMatchObject({ code: ErrorCode.io, superseded: true });

        expect(store.getState().errorNotification.pending).toEqual([]);
      });
    });

    describe("loadDirectory in the background", () => {
      const showing = (path: string) => {
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = [path];
        preloaded.fileNavigator.historyIndex = 0;
        preloaded.fileNavigator.entries = [createMockDirEntry({ name: "old" })];
        preloaded.fileNavigator.loadedPath = path;
        return createTestStore(preloaded);
      };

      it("keeps the list on screen while the folder is read again", async () => {
        let finishListing: (buffer: ArrayBuffer) => void = () => {};
        vi.mocked(binaryApi.getEntriesInDir).mockReturnValueOnce(
          new Promise((resolve) => {
            finishListing = resolve;
          }),
        );
        store = showing("/a");

        const refresh = store.dispatch(loadDirectory({ dirPath: "/a", background: true }));

        expect(binaryApi.getEntriesInDir).toHaveBeenCalledWith("/a");
        expect(store.getState().fileNavigator.isLoading).toBe(false);
        expect(store.getState().fileNavigator.entries).toHaveLength(1);

        finishListing(new ArrayBuffer(0));
        await refresh;

        expect(store.getState().fileNavigator.entries).toEqual([]);
        expect(store.getState().fileNavigator.loadedPath).toBe("/a");
        expect(store.getState().fileNavigator.isLoading).toBe(false);
      });

      // A move into the folder is still being listed when the folder changes.
      it("leaves the loading indicator of a listing in flight on", async () => {
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = ["/a"];
        preloaded.fileNavigator.historyIndex = 0;
        preloaded.fileNavigator.isLoading = true;
        store = createTestStore(preloaded);
        let finishListing: (buffer: ArrayBuffer) => void = () => {};
        vi.mocked(binaryApi.getEntriesInDir).mockReturnValueOnce(
          new Promise((resolve) => {
            finishListing = resolve;
          }),
        );

        const refresh = store.dispatch(loadDirectory({ dirPath: "/a", background: true }));
        expect(store.getState().fileNavigator.isLoading).toBe(true);

        finishListing(new ArrayBuffer(0));
        await refresh;
        expect(store.getState().fileNavigator.isLoading).toBe(false);
      });

      it("empties the list and reports the error when the folder cannot be read", async () => {
        vi.mocked(binaryApi.getEntriesInDir).mockRejectedValueOnce(
          new CommandError(ErrorCode.io, "gone"),
        );
        store = showing("/a");

        await store.dispatch(loadDirectory({ dirPath: "/a", background: true }));

        expect(store.getState().fileNavigator.entries).toEqual([]);
        expect(store.getState().fileNavigator.loadedPath).toBeNull();
        expect(store.getState().fileNavigator.isLoading).toBe(false);
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "explorer", code: ErrorCode.io },
        ]);
      });

      it("dispatches nothing for a folder that is not on screen", async () => {
        store = showing("/a");

        await store.dispatch(loadDirectory({ dirPath: "/b", background: true }));

        expect(binaryApi.getEntriesInDir).not.toHaveBeenCalled();
        expect(store.getState().fileNavigator.history).toEqual(["/a"]);
      });
    });

    describe("loadDirectory thunk", () => {
      // Verify that directory entries are updated and added to history
      it("should update entries for directory", async () => {
        // Construct binary data matching convertEntriesInDir's expectation
        const name = "file.jpg";
        const nameBuffer = new TextEncoder().encode(name);
        const buffer = new ArrayBuffer(1 + 4 + nameBuffer.byteLength + 8);
        const view = new DataView(buffer);

        view.setUint8(0, 0); // isDirectory = false
        view.setUint32(1, nameBuffer.byteLength); // name length
        new Uint8Array(buffer).set(nameBuffer, 5); // name data
        view.setBigUint64(5 + nameBuffer.byteLength, BigInt(0)); // lastModified = 0

        vi.mocked(binaryApi.getEntriesInDir).mockResolvedValue(buffer);

        await store.dispatch(loadDirectory({ dirPath: "/test/dir", forceUpdate: true }));

        const state = store.getState().fileNavigator;
        expect(state.entries[0].name).toBe("file.jpg");
        expect(state.history).toContain("/test/dir");
      });

      // Verify that update is skipped if already at the path
      it("should handle return undefined if already at the path", async () => {
        const preloadedState = {
          fileNavigator: {
            history: ["/current"],
            historyIndex: 0,
            entries: [] as DirEntry[],
            searchText: "",
            isLoading: false,
            requestId: null,
            pendingPath: null,
            loadedPath: "/current",
          },
        } as RootState;
        store = createTestStore(preloadedState);

        const result = await store.dispatch(loadDirectory({ dirPath: "/current" }));
        expect(result.payload).toBeUndefined();
      });

      // Verify error handling when directory path is empty
      it("should handle error when directory path is empty", async () => {
        await store.dispatch(loadDirectory({ dirPath: "" }));

        expect(store.getState().errorNotification.pending).toEqual([
          { context: "explorer", code: ErrorCode.path },
        ]);
      });

      // Verify handling of CommandError during File Navigator update
      it("should handle CommandError during File Navigator update", async () => {
        const mockError = new CommandError(ErrorCode.other, "dir failed");
        vi.mocked(binaryApi.getEntriesInDir).mockRejectedValue(mockError);

        await store.dispatch(loadDirectory({ dirPath: "/error/dir", forceUpdate: true }));

        expect(store.getState().errorNotification.pending).toEqual([
          { context: "explorer", code: ErrorCode.other },
        ]);
      });

      // Verify handling of generic error during entry conversion
      it("should handle generic error during entry conversion", async () => {
        const testError = "read failed";
        vi.mocked(binaryApi.getEntriesInDir).mockRejectedValue(testError);

        await store.dispatch(loadDirectory({ dirPath: "/error/dir", forceUpdate: true }));

        expect(store.getState().errorNotification.pending).toEqual([
          { context: "explorer", code: ErrorCode.other },
        ]);
      });
    });
  });
});
