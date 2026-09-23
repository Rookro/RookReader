import { getCurrentWindow } from "@tauri-apps/api/window";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestStore, createTestWrapper } from "../test/utils";
import { useFlushReadingStateOnClose } from "./useFlushReadingStateOnClose";

describe("useFlushReadingStateOnClose", () => {
  let closeHandler: (() => Promise<void>) | undefined;
  const unlisten = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    closeHandler = undefined;
    vi.mocked(getCurrentWindow).mockReturnValue({
      onCloseRequested: vi.fn((handler) => {
        closeHandler = handler;
        return Promise.resolve(unlisten);
      }),
    } as unknown as ReturnType<typeof getCurrentWindow>);
  });

  it("flushes the pending reading position when the window is asked to close", async () => {
    const store = createTestStore();
    store.flushReadingState = vi.fn(() => Promise.resolve());
    renderHook(() => useFlushReadingStateOnClose(), { wrapper: createTestWrapper({ store }) });

    expect(closeHandler).toBeDefined();
    await closeHandler?.();

    expect(store.flushReadingState).toHaveBeenCalledTimes(1);
  });

  it("waits for the write before letting the close go on", async () => {
    let finishWrite: () => void = () => {};
    const store = createTestStore();
    store.flushReadingState = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    renderHook(() => useFlushReadingStateOnClose(), { wrapper: createTestWrapper({ store }) });

    let closed = false;
    const closing = closeHandler?.().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    finishWrite();
    await closing;
    expect(closed).toBe(true);
  });

  it("stops listening when it unmounts", async () => {
    const { unmount } = renderHook(() => useFlushReadingStateOnClose(), {
      wrapper: createTestWrapper(),
    });
    unmount();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
