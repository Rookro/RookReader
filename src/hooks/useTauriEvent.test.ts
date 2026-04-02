import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTauriEvent } from "./useTauriEvent";

describe("useTauriEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that the listener is registered on component mount and unlisted on unmount
  it("should setup listener on mount and cleanup on unmount", async () => {
    const mockUnlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(mockUnlisten);
    const handler = vi.fn();

    const { unmount } = renderHook(() => useTauriEvent("test-event", handler));

    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith("test-event", expect.any(Function));
    });

    unmount();
    expect(mockUnlisten).toHaveBeenCalled();
  });

  // Verify that the current handler is correctly called when an event is received
  it("should call current handler when event is received", async () => {
    let eventCallback: Parameters<typeof listen>[1] | undefined;
    vi.mocked(listen).mockImplementation((_name, cb) => {
      eventCallback = cb;
      return Promise.resolve(vi.fn());
    });

    const handler = vi.fn();
    renderHook(() => useTauriEvent("test-event", handler));

    await waitFor(() => expect(listen).toHaveBeenCalled());

    eventCallback?.({ payload: "data" } as Parameters<Parameters<typeof listen>[1]>[0]);
    expect(handler).toHaveBeenCalledWith({ payload: "data" });
  });

  // Verify that the handler can be updated without re-subscribing (re-running listen)
  it("should update handler without re-subscribing", async () => {
    vi.mocked(listen).mockResolvedValue(vi.fn());

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(({ handler }) => useTauriEvent("test-event", handler), {
      initialProps: { handler: handler1 },
    });

    await waitFor(() => expect(listen).toHaveBeenCalledTimes(1));

    rerender({ handler: handler2 });

    expect(listen).toHaveBeenCalledTimes(1);
  });

  // Verify that unmount is handled correctly even if the component unmounts before the asynchronous listen process completes
  it("should handle unmount before listen resolves", async () => {
    let resolveListen: (value: UnlistenFn) => void = () => {};
    const mockUnlisten = vi.fn();
    vi.mocked(listen).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveListen = resolve;
        }),
    );

    const { unmount } = renderHook(() => useTauriEvent("test-event", vi.fn()));

    unmount();
    resolveListen(mockUnlisten);

    await waitFor(() => {
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });
});
