import { exists, watchImmediate } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "../../../store/store";
import { useDirectoryWatcher } from "./useDirectoryWatcher";

vi.mock("../../../store/store", () => ({
  useAppSelector: vi.fn(),
}));

type WatchHandler = Parameters<typeof watchImmediate>[1];
type WatchEvent = Parameters<WatchHandler>[0];

const change = (type: unknown) => ({ type, paths: [], attrs: {} }) as WatchEvent;

describe("useDirectoryWatcher", () => {
  const mockCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Renders the hook on `/test/path` and resolves to what reports a change to it. The
   * timers are faked from then on, so a test decides how much time passes.
   */
  const watching = async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);
    let handler: WatchHandler | undefined;
    vi.mocked(watchImmediate).mockImplementation((_path, cb) => {
      handler = cb;
      return Promise.resolve(vi.fn());
    });

    const hook = renderHook(({ dir }) => useDirectoryWatcher(dir, mockCallback), {
      initialProps: { dir: "/test/path" },
    });
    await waitFor(() => expect(handler).toBeDefined());
    vi.useFakeTimers();

    return { ...hook, report: (type: unknown) => handler?.(change(type)) };
  };

  /** Makes the next call of the callback run until the returned function is called. */
  const slowCallback = () => {
    let finish: () => void = () => {};
    mockCallback.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    return () => finish();
  };

  // Verify that watcher is not setup if directory watch is disabled
  it("should not setup watcher if directory watch is disabled", () => {
    vi.mocked(useAppSelector).mockReturnValue(false);

    renderHook(() => useDirectoryWatcher("/test/path", mockCallback));
    expect(watchImmediate).not.toHaveBeenCalled();
  });

  // Verify that watcher is not setup if dirPath is null
  it("should not setup watcher if dirPath is null", () => {
    vi.mocked(useAppSelector).mockReturnValue(true);

    renderHook(() => useDirectoryWatcher(null, mockCallback));
    expect(watchImmediate).not.toHaveBeenCalled();
  });

  // A path inside an archive has nothing on disk to watch.
  it("should not setup watcher for a path that does not exist on disk", async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);
    vi.mocked(exists).mockResolvedValueOnce(false);

    renderHook(() => useDirectoryWatcher("/books/comic.zip/ch1", mockCallback));

    await waitFor(() => expect(exists).toHaveBeenCalledWith("/books/comic.zip/ch1"));
    expect(watchImmediate).not.toHaveBeenCalled();
  });

  // The debounced `watch` reads the whole folder on the main thread when it starts.
  it("should watch the folder without the plugin's debounce", async () => {
    await watching();

    expect(watchImmediate).toHaveBeenCalledWith("/test/path", expect.any(Function));
  });

  it.each([
    ["create", { create: { kind: "file" } }],
    ["modify", { modify: { kind: "any" } }],
    ["remove", { remove: { kind: "file" } }],
  ])("should call the callback 500 ms after a %s event", async (_name, type) => {
    const { report } = await watching();

    report(type);
    vi.advanceTimersByTime(499);
    expect(mockCallback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it("should call the callback once for changes that follow within 500 ms", async () => {
    const { report } = await watching();

    report({ create: { kind: "file" } });
    vi.advanceTimersByTime(200);
    report({ modify: { kind: "any" } });
    report({ remove: { kind: "file" } });
    vi.advanceTimersByTime(300);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // The later changes did not start a delay of their own.
    vi.advanceTimersByTime(1000);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it("should call the callback again for a change after the delay has passed", async () => {
    const { report } = await watching();

    report({ create: { kind: "file" } });
    await vi.advanceTimersByTimeAsync(500);
    report({ remove: { kind: "file" } });
    await vi.advanceTimersByTimeAsync(500);

    expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  it("should wait for a running callback before it starts the next delay", async () => {
    const finish = slowCallback();
    const { report } = await watching();

    report({ create: { kind: "file" } });
    await vi.advanceTimersByTimeAsync(500);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    // A change while the callback is still running does not start it again.
    report({ modify: { kind: "any" } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(499);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  it("should not call the callback again when nothing changed while it ran", async () => {
    const finish = slowCallback();
    const { report } = await watching();

    report({ create: { kind: "file" } });
    await vi.advanceTimersByTimeAsync(500);
    finish();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it("should not call the callback again when unmounted while it ran", async () => {
    const finish = slowCallback();
    const { report, unmount } = await watching();

    report({ create: { kind: "file" } });
    await vi.advanceTimersByTimeAsync(500);
    report({ modify: { kind: "any" } });
    unmount();
    finish();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an access event", { access: { kind: "any" } }],
    ["an event of another kind", "other"],
    ["an event of any kind", "any"],
  ])("should not call the callback for %s", async (_name, type) => {
    const { report } = await watching();

    report(type);
    vi.advanceTimersByTime(500);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  it("should drop a pending call when unmounted", async () => {
    const { report, unmount } = await watching();

    report({ create: { kind: "file" } });
    unmount();
    vi.advanceTimersByTime(500);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  it("should drop a pending call when the folder changes", async () => {
    const { report, rerender } = await watching();

    report({ create: { kind: "file" } });
    rerender({ dir: "/other/path" });
    vi.advanceTimersByTime(500);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  // The watcher closes asynchronously, so it can still report after it was told to stop.
  it("should ignore a change reported after unmount", async () => {
    const { report, unmount } = await watching();

    unmount();
    report({ create: { kind: "file" } });
    vi.advanceTimersByTime(500);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  // Verify that an error log is output if watcher setup fails
  it("should log error if watch fails", async () => {
    vi.mocked(useAppSelector).mockReturnValue(true);
    vi.mocked(watchImmediate).mockRejectedValue(new Error("Watch failed"));

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
    vi.mocked(watchImmediate).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWatch = resolve;
        }),
    );

    const { unmount } = renderHook(() => useDirectoryWatcher("/test/path", mockCallback));
    await waitFor(() => expect(watchImmediate).toHaveBeenCalled());

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
    vi.mocked(watchImmediate).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const { rerender } = renderHook(({ dir }) => useDirectoryWatcher(dir, mockCallback), {
      initialProps: { dir: "/path/a" },
    });

    await waitFor(() => expect(watchImmediate).toHaveBeenCalled());

    // Change dirPath before the first watch resolves, then resolve the stale one.
    rerender({ dir: "/path/b" });
    resolvers[0]?.(staleUnwatch);

    await waitFor(() => {
      expect(staleUnwatch).toHaveBeenCalled();
    });
  });
});
