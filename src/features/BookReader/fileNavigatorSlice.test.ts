import { beforeEach, describe, expect, it, vi } from "vitest";
import * as DirectoryCommands from "../../bindings/DirectoryCommands";
import { createMockDirEntry } from "../../test/factories";
import {
  type AppStore,
  createBasePreloadedState,
  createTestStore,
  type RootState,
} from "../../test/utils";
import type { DirEntry } from "../../types/DirEntry";
import { CommandError, ErrorCode } from "../../types/Error";
import fileNavigatorReducer, {
  clearExplorerError,
  goBackExplorerHistory,
  goForwardExplorerHistory,
  setExploreBasePath,
  setIsDirEntriesLoading,
  setSearchText,
  updateExploreBasePath,
} from "./fileNavigatorSlice";

describe("FileNavigatorReducer", () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  describe("reducers", () => {
    // Verify that explorer base path is set and history is updated
    it("should handle setExploreBasePath and update history", () => {
      const initialState = { history: ["/old"], historyIndex: 0 } as RootState["fileNavigator"];
      const state = fileNavigatorReducer(initialState, setExploreBasePath("/new"));
      expect(state.history).toEqual(["/old", "/new"]);
      expect(state.historyIndex).toBe(1);
    });

    // Verify that history is not updated when setExploreBasePath is called with current path
    it("should not update history if setExploreBasePath is called with current path", () => {
      const initialState = { history: ["/current"], historyIndex: 0 } as RootState["fileNavigator"];
      const state = fileNavigatorReducer(initialState, setExploreBasePath("/current"));
      expect(state.history).toHaveLength(1);
    });

    // Verify that subsequent history is sliced when a new explorer path is set while in the middle of history
    it("should slice history in setExploreBasePath when index is not at the end", () => {
      const initialState = {
        history: ["/d1", "/d2", "/d3"],
        historyIndex: 1,
      } as RootState["fileNavigator"];
      const state = fileNavigatorReducer(initialState, setExploreBasePath("/new"));
      expect(state.history).toEqual(["/d1", "/d2", "/new"]);
      expect(state.historyIndex).toBe(2);
    });

    // Verify that explorer history navigation (back/forward) works correctly
    it("should handle history navigation", () => {
      const initialState = {
        history: ["d1", "d2", "d3"],
        historyIndex: 1,
      } as RootState["fileNavigator"];

      let state = fileNavigatorReducer(initialState, goBackExplorerHistory());
      expect(state.historyIndex).toBe(0);
      state = fileNavigatorReducer(state, goBackExplorerHistory());
      expect(state.historyIndex).toBe(0);

      state = fileNavigatorReducer(initialState, goForwardExplorerHistory());
      expect(state.historyIndex).toBe(2);
      state = fileNavigatorReducer(state, goForwardExplorerHistory());
      expect(state.historyIndex).toBe(2);
    });

    // Verify that explorer state (search text, loading flag) is updated correctly
    it("should handle explorer state (searchText, loading)", () => {
      const initialState = {
        searchText: "",
        isLoading: false,
      } as RootState["fileNavigator"];

      let state = fileNavigatorReducer(initialState, setSearchText("query"));
      expect(state.searchText).toBe("query");

      state = fileNavigatorReducer(state, setIsDirEntriesLoading(true));
      expect(state.isLoading).toBe(true);
    });

    // Verify that the explorer error state is cleared correctly
    it("should handle clear errors", () => {
      const initialState = { error: { code: ErrorCode.other } } as RootState["fileNavigator"];

      const state = fileNavigatorReducer(initialState, clearExplorerError());
      expect(state.error).toBeNull();
    });
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify error handling for rejected actions with undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const mockState = { error: null } as RootState["fileNavigator"];

      const state = fileNavigatorReducer(
        mockState,
        updateExploreBasePath.rejected(new Error(), "requestId", { dirPath: "arg" }, undefined),
      );
      expect(state.error).toBeNull();
    });

    describe("updateExploreBasePath staleness", () => {
      const explorerAt = (path: string, requestId: string) => {
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
          explorerAt("/good", "r2"),
          updateExploreBasePath.rejected(null, "r1", { dirPath: "/bad" }, { code: ErrorCode.io }),
        );
        expect(state.entries).toHaveLength(1);
        expect(state.error).toBeNull();
        expect(state.isLoading).toBe(true);
      });

      it("ignores a superseded listing of the same folder", () => {
        const state = fileNavigatorReducer(
          explorerAt("/a", "r2"),
          updateExploreBasePath.fulfilled({ path: "/a", entries: [] }, "r1", {
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
          updateExploreBasePath.pending("r1", { dirPath: "/a", forceUpdate: true }),
        );
        expect(state.pendingPath).toBe("/a");
        state = fileNavigatorReducer(
          state,
          updateExploreBasePath.pending("r2", { dirPath: "/b", forceUpdate: true }),
        );
        state = fileNavigatorReducer(
          state,
          updateExploreBasePath.fulfilled({ path: "/a", entries: [] }, "r1", { dirPath: "/a" }),
        );
        expect(state.pendingPath).toBe("/b");
        state = fileNavigatorReducer(
          state,
          updateExploreBasePath.rejected(null, "r2", { dirPath: "/b" }, { code: ErrorCode.io }),
        );
        expect(state.pendingPath).toBeNull();
      });

      it("dispatches nothing when the folder is already shown", async () => {
        const preloaded = createBasePreloadedState();
        preloaded.fileNavigator.history = ["/a"];
        preloaded.fileNavigator.historyIndex = 0;
        store = createTestStore(preloaded);

        await store.dispatch(updateExploreBasePath({ dirPath: "/a" }));

        expect(DirectoryCommands.getEntriesInDir).not.toHaveBeenCalled();
        expect(store.getState().fileNavigator.requestId).toBeNull();
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

        const state = store.getState().fileNavigator;
        expect(state.entries[0].name).toBe("file.jpg");
        expect(state.history).toContain("/test/dir");
      });

      // Verify that update is skipped if already at the path
      it("should handle return undefined if already at the path", async () => {
        const preloadedState = {
          fileNavigator: { history: ["/current"], historyIndex: 0, entries: [] as DirEntry[] },
        } as RootState;
        store = createTestStore(preloadedState);

        const result = await store.dispatch(updateExploreBasePath({ dirPath: "/current" }));
        expect(result.payload).toBeUndefined();
      });

      // Verify error handling when directory path is empty
      it("should handle error when directory path is empty", async () => {
        await store.dispatch(updateExploreBasePath({ dirPath: "" }));

        const state = store.getState().fileNavigator;
        expect(state.error?.code).toBe(ErrorCode.path);
      });

      // Verify handling of CommandError during explorer update
      it("should handle CommandError during explorer update", async () => {
        const mockError = new CommandError(ErrorCode.other, "dir failed");
        vi.mocked(DirectoryCommands.getEntriesInDir).mockRejectedValue(mockError);

        await store.dispatch(updateExploreBasePath({ dirPath: "/error/dir", forceUpdate: true }));

        const state = store.getState().fileNavigator;
        expect(state.error?.code).toBe(ErrorCode.other);
        expect(state.error?.message).toContain("dir failed");
      });

      // Verify handling of generic error during entry conversion
      it("should handle generic error during entry conversion", async () => {
        const testError = "read failed";
        vi.mocked(DirectoryCommands.getEntriesInDir).mockRejectedValue(testError);

        await store.dispatch(updateExploreBasePath({ dirPath: "/error/dir", forceUpdate: true }));

        const state = store.getState().fileNavigator;
        expect(state.error?.message).toContain(testError);
      });
    });
  });
});
