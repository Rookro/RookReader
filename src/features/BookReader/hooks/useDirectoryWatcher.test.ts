import { watch } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "../../../store/store";
import { useDirectoryWatcher } from "./useDirectoryWatcher";

vi.mock("../../../store/store", () => ({
  useAppSelector: vi.fn(),
}));

describe("useDirectoryWatcher", () => {
  const mockCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that watcher is not setup if directory watch is disabled
  it("should not setup watcher if directory watch is disabled", () => {
    vi.mocked(useAppSelector).mockReturnValue(false);

    renderHook(() => useDirectoryWatcher("/test/path", mockCallback));
    expect(watch).not.toHaveBeenCalled();
  });

  // Verify that watcher is not setup if dirPath is null
  it("should not setup watcher if dirPath is null", () => {
    vi.mocked(useAppSelector).mockReturnValue(true);

    renderHook(() => useDirectoryWatcher(null, mockCallback));
    expect(watch).not.toHaveBeenCalled();
  });

  // Verify that watcher is setup and callback is called on file creation, modification, or removal events
  it("should setup watcher and call callback on create event", async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);
    let eventHandler: Parameters<typeof watch>[1] | undefined;
    vi.mocked(watch).mockImplementation((_path, handler) => {
      eventHandler = handler;
      return Promise.resolve(vi.fn());
    });

    renderHook(() => useDirectoryWatcher("/test/path", mockCallback));

    await waitFor(() => {
      expect(watch).toHaveBeenCalledWith("/test/path", expect.any(Function), { delayMs: 500 });
    });

    // Simulate events
    eventHandler?.({ type: { create: {} } } as Parameters<Parameters<typeof watch>[1]>[0]);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    eventHandler?.({ type: { modify: {} } } as Parameters<Parameters<typeof watch>[1]>[0]);
    expect(mockCallback).toHaveBeenCalledTimes(2);

    eventHandler?.({ type: { remove: {} } } as Parameters<Parameters<typeof watch>[1]>[0]);
    expect(mockCallback).toHaveBeenCalledTimes(3);

    // Should not trigger for other events
    eventHandler?.({ type: { access: {} } } as Parameters<Parameters<typeof watch>[1]>[0]);
    expect(mockCallback).toHaveBeenCalledTimes(3);

    eventHandler?.({ type: "other" } as Parameters<Parameters<typeof watch>[1]>[0]);
    expect(mockCallback).toHaveBeenCalledTimes(3);
  });

  // Verify that an error log is output if watcher setup fails
  it("should log error if watch fails", async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);
    vi.mocked(watch).mockRejectedValue(new Error("Watch failed"));

    renderHook(() => useDirectoryWatcher("/test/path", mockCallback));

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to watch /test/path"));
    });
  });

  // Verify that a watcher resolved AFTER unmount is torn down immediately (no leak)
  it("should unwatch when unmounted before watch resolves", async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);

    let resolveWatch: (value: () => void) => void = () => {};
    const mockUnwatch = vi.fn();
    vi.mocked(watch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWatch = resolve;
        }),
    );

    const { unmount } = renderHook(() => useDirectoryWatcher("/test/path", mockCallback));

    // Unmount before the watch promise resolves, then resolve it.
    unmount();
    resolveWatch(mockUnwatch);

    await waitFor(() => {
      expect(mockUnwatch).toHaveBeenCalled();
    });
  });

  // Verify that a stale watcher resolved after dirPath changes is torn down immediately
  it("should unwatch the previous watcher when dirPath changes before watch resolves", async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);

    const resolvers: Array<(value: () => void) => void> = [];
    const staleUnwatch = vi.fn();
    vi.mocked(watch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { rerender } = renderHook(({ dir }) => useDirectoryWatcher(dir, mockCallback), {
      initialProps: { dir: "/path/a" },
    });

    // Change dirPath before the first watch resolves, then resolve the stale one.
    rerender({ dir: "/path/b" });
    resolvers[0]?.(staleUnwatch);

    await waitFor(() => {
      expect(staleUnwatch).toHaveBeenCalled();
    });
  });
});
