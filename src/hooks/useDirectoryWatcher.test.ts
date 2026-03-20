import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDirectoryWatcher } from "./useDirectoryWatcher";
import { useAppSelector } from "../Store";
import { watch } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";

vi.mock("../Store", () => ({
  useAppSelector: vi.fn(),
}));

describe("useDirectoryWatcher", () => {
  const mockCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that watcher is not setup if isWatchEnabled is false
  it("should not setup watcher if isWatchEnabled is false", () => {
    vi.mocked(useAppSelector).mockReturnValue({ isWatchEnabled: false });

    renderHook(() => useDirectoryWatcher("/test/path", mockCallback));
    expect(watch).not.toHaveBeenCalled();
  });

  // Verify that watcher is not setup if dirPath is null
  it("should not setup watcher if dirPath is null", () => {
    vi.mocked(useAppSelector).mockReturnValue({ isWatchEnabled: true });

    renderHook(() => useDirectoryWatcher(null, mockCallback));
    expect(watch).not.toHaveBeenCalled();
  });

  // Verify that watcher is setup and callback is called on file creation, modification, or removal events
  it("should setup watcher and call callback on create event", async () => {
    vi.mocked(useAppSelector).mockReturnValue({ isWatchEnabled: true });
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
    vi.mocked(useAppSelector).mockReturnValue({ isWatchEnabled: true });
    vi.mocked(watch).mockRejectedValue(new Error("Watch failed"));

    renderHook(() => useDirectoryWatcher("/test/path", mockCallback));

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to watch /test/path"));
    });
  });
});
