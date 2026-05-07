import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useResizeObserver } from "./useResizeObserver";

describe("useResizeObserver", () => {
  let observerCallback: ResizeObserverCallback;
  let mockObserve = vi.fn();
  let mockDisconnect = vi.fn();

  beforeEach(() => {
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const createMockEntry = (width: number, element: HTMLElement): ResizeObserverEntry => ({
    contentRect: {
      width,
      height: 500,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 500,
      toJSON: () => ({}),
    },
    target: element,
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  });

  it("should observe element width and update immediately on first visibility", () => {
    const mockElement = document.createElement("div");
    const ref = { current: mockElement };

    const { result } = renderHook(() => useResizeObserver(ref));

    expect(mockObserve).toHaveBeenCalledWith(mockElement);
    expect(result.current).toBe(0);

    // Initial visibility
    act(() => {
      observerCallback([createMockEntry(500, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(500);
  });

  it("should return 0 if ref is null", () => {
    const { result } = renderHook(() => useResizeObserver({ current: null }));
    expect(result.current).toBe(0);
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("should not update if width is 0 or unchanged", () => {
    const mockElement = document.createElement("div");
    const ref = { current: mockElement };

    const { result } = renderHook(() => useResizeObserver(ref));

    // Initial 0 width (ignored)
    act(() => {
      observerCallback([createMockEntry(0, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(0);

    // First valid width
    act(() => {
      observerCallback([createMockEntry(500, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(500);

    // Same width (ignored)
    act(() => {
      observerCallback([createMockEntry(500, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(500);
  });

  it("should ignore empty entries", () => {
    const mockElement = document.createElement("div");
    const ref = { current: mockElement };

    const { result } = renderHook(() => useResizeObserver(ref));

    act(() => {
      observerCallback([], {} as ResizeObserver);
    });
    expect(result.current).toBe(0);
  });

  it("should update immediately shortly after initial visibility", () => {
    const mockElement = document.createElement("div");
    const ref = { current: mockElement };

    const { result } = renderHook(() => useResizeObserver(ref));

    // 0ms: Initial visibility
    act(() => {
      observerCallback([createMockEntry(500, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(500);

    // 100ms: Shortly after (< 200ms)
    act(() => {
      vi.advanceTimersByTime(100);
      observerCallback([createMockEntry(600, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(600);
  });

  it("should debounce updates long after initial visibility", () => {
    const mockElement = document.createElement("div");
    const ref = { current: mockElement };

    const { result } = renderHook(() => useResizeObserver(ref, 100));

    // 0ms: Initial visibility
    act(() => {
      observerCallback([createMockEntry(500, mockElement)], {} as ResizeObserver);
    });
    expect(result.current).toBe(500);

    // 300ms: Long after (> 200ms)
    act(() => {
      vi.advanceTimersByTime(300);
      observerCallback([createMockEntry(700, mockElement)], {} as ResizeObserver);
    });

    // Should NOT have updated yet due to debounce
    expect(result.current).toBe(500);

    // Advance time to trigger debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(700);
  });

  it("should cleanup observer and debounced function on unmount", () => {
    const mockElement = document.createElement("div");
    const ref = { current: mockElement };

    const { unmount } = renderHook(() => useResizeObserver(ref));

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should handle ref changes", () => {
    const element1 = document.createElement("div");
    const element2 = document.createElement("div");
    const ref = { current: element1 };

    const { rerender } = renderHook(({ ref }) => useResizeObserver(ref), {
      initialProps: { ref },
    });

    expect(mockObserve).toHaveBeenCalledWith(element1);

    // Change ref
    ref.current = element2;
    rerender({ ref: { ...ref } }); // Create new ref object to trigger useEffect

    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalledWith(element2);
  });
});
