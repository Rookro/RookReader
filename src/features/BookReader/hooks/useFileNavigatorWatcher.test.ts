import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDirEntry } from "../../../test/factories";
import { createBasePreloadedState, createTestStore, createTestWrapper } from "../../../test/utils";
import * as FileNavigatorSlice from "../fileNavigatorSlice";
import { useDirectoryWatcher } from "./useDirectoryWatcher";
import { useFileNavigatorWatcher } from "./useFileNavigatorWatcher";

vi.mock("./useDirectoryWatcher", () => ({
  useDirectoryWatcher: vi.fn(),
}));

vi.mock("../fileNavigatorSlice", async () => {
  const actual = await vi.importActual<typeof FileNavigatorSlice>("../fileNavigatorSlice");
  return {
    ...actual,
    loadDirectory: vi.fn(),
  };
});

describe("useFileNavigatorWatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes null to useDirectoryWatcher when no folder is open", () => {
    const store = createTestStore(createBasePreloadedState());

    renderHook(() => useFileNavigatorWatcher(), { wrapper: createTestWrapper({ store }) });

    expect(useDirectoryWatcher).toHaveBeenCalledWith(null, expect.any(Function));
  });

  it("watches the current folder and returns the background loadDirectory promise on change", () => {
    const pending = Promise.resolve("listing-result");
    vi.mocked(FileNavigatorSlice.loadDirectory).mockReturnValue(
      (() => pending) as unknown as ReturnType<typeof FileNavigatorSlice.loadDirectory>,
    );
    const state = createBasePreloadedState();
    state.fileNavigator.history = ["/a"];
    state.fileNavigator.historyIndex = 0;
    const store = createTestStore(state);

    renderHook(() => useFileNavigatorWatcher(), { wrapper: createTestWrapper({ store }) });

    const [watchedPath, onChange] = vi.mocked(useDirectoryWatcher).mock.calls.at(-1) ?? [];
    expect(watchedPath).toBe("/a");

    let returned: unknown;
    act(() => {
      returned = onChange?.();
    });

    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledTimes(1);
    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
      dirPath: "/a",
      background: true,
    });
    expect(returned).toBe(pending);
  });

  it("does not re-render or recreate the watcher callback when entries or searchText change", () => {
    const state = createBasePreloadedState();
    state.fileNavigator.history = ["/a"];
    state.fileNavigator.historyIndex = 0;
    const store = createTestStore(state);

    const { rerender } = renderHook(() => useFileNavigatorWatcher(), {
      wrapper: createTestWrapper({ store }),
    });

    const initialCallCount = vi.mocked(useDirectoryWatcher).mock.calls.length;
    const initialCallback = vi.mocked(useDirectoryWatcher).mock.calls.at(-1)?.[1];

    act(() => {
      store.dispatch(FileNavigatorSlice.setSearchText("foo"));
      store.dispatch({
        type: "fileNavigator/loadDirectory/fulfilled",
        payload: { path: "/a", entries: [createMockDirEntry({ name: "book.zip" })] },
        meta: { requestId: null, arg: { dirPath: "/a", background: true } },
      });
    });

    expect(vi.mocked(useDirectoryWatcher).mock.calls.length).toBe(initialCallCount);

    rerender();
    expect(vi.mocked(useDirectoryWatcher).mock.calls.at(-1)?.[1]).toBe(initialCallback);
  });
});
