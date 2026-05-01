import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResizeObserver } from "./useResizeObserver";

describe("useResizeObserver", () => {
  it("should observe element width", () => {
    let observerCallback: ResizeObserverCallback = () => {};
    const mockObserve = vi.fn();
    const mockDisconnect = vi.fn();

    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observerCallback = callback;
        }
        observe = mockObserve;
        disconnect = mockDisconnect;
      },
    );

    const mockElement = document.createElement("div");
    // Mock getBoundingClientRect if needed, but ResizeObserver uses contentRect from entries
    const ref = { current: mockElement };

    const { result } = renderHook(() => useResizeObserver(ref));

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
    expect(result.current).toBe(0);

    // Simulate resize event
    const entry: ResizeObserverEntry = {
      contentRect: {
        width: 500,
        height: 500,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 500,
        bottom: 500,
        toJSON: () => ({}),
      },
      target: mockElement,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    };

    // First update should be immediate
    act(() => {
      observerCallback([entry], {} as ResizeObserver);
    });
    expect(result.current).toBe(500);

    // Cleanup
    renderHook(() => useResizeObserver(ref)).unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should return 0 if ref is null", () => {
    const { result } = renderHook(() => useResizeObserver({ current: null }));
    expect(result.current).toBe(0);
  });
});
