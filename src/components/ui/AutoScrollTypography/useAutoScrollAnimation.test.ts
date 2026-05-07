import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutoScrollAnimation } from "./useAutoScrollAnimation";

describe("useAutoScrollAnimation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should return initial state", () => {
    const { result } = renderHook(() => useAutoScrollAnimation(50, 2));

    expect(result.current.isOverflowing).toBe(false);
    expect(result.current.animationStyle).toEqual({});
    expect(result.current.delayPercent).toBe(0);
    expect(result.current.containerRef.current).toBeNull();
    expect(result.current.contentRef.current).toBeNull();
  });

  it("should detect overflow and calculate animation parameters", () => {
    const pixelsPerSecond = 50;
    const delaySeconds = 2;

    let observerCallback: ResizeObserverCallback = () => {};

    class ResizeObserverMock {
      constructor(cb: ResizeObserverCallback) {
        observerCallback = cb;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    // Mock container and content elements using full DOM elements
    const mockContainer = document.createElement("div");
    const mockContent = document.createElement("span");

    Object.defineProperty(mockContainer, "clientWidth", {
      get: () => 100,
      configurable: true,
    });
    Object.defineProperty(mockContent, "offsetWidth", {
      get: () => 200,
      configurable: true,
    });

    const { result, rerender } = renderHook(
      ({ pps, ds }) => {
        const res = useAutoScrollAnimation(pps, ds);
        res.containerRef.current = mockContainer;
        res.contentRef.current = mockContent;
        return res;
      },
      {
        initialProps: { pps: pixelsPerSecond, ds: delaySeconds },
      },
    );

    // Trigger calculation
    act(() => {
      rerender({ pps: pixelsPerSecond, ds: delaySeconds });
    });

    // Also trigger via observer callback
    act(() => {
      observerCallback([], {} as ResizeObserver);
    });

    // Verify overflowing state
    expect(result.current.isOverflowing).toBe(true);

    // Verify animation style calculations
    expect(result.current.animationStyle).toEqual({
      "--scroll-duration": "6s",
      "--scroll-offset": "-200px",
    });

    expect(result.current.delayPercent).toBeCloseTo(33.333, 3);

    // Test resizing to a different overflow value
    Object.defineProperty(mockContent, "offsetWidth", {
      get: () => 150,
      configurable: true,
    });
    act(() => {
      observerCallback([], {} as ResizeObserver);
    });

    expect(result.current.animationStyle).toEqual({
      "--scroll-duration": "5s",
      "--scroll-offset": "-150px",
    });
    expect(result.current.delayPercent).toBe(40);

    // Test resizing to non-overflow
    Object.defineProperty(mockContent, "offsetWidth", {
      get: () => 50,
      configurable: true,
    });
    act(() => {
      observerCallback([], {} as ResizeObserver);
    });

    expect(result.current.isOverflowing).toBe(false);
    expect(result.current.animationStyle).toEqual({});
    expect(result.current.delayPercent).toBe(0);
  });

  it("should handle non-overflowing state initially", () => {
    let observerCallback: ResizeObserverCallback = () => {};

    class ResizeObserverMock {
      constructor(cb: ResizeObserverCallback) {
        observerCallback = cb;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const mockContainer = document.createElement("div");
    const mockContent = document.createElement("span");

    Object.defineProperty(mockContainer, "clientWidth", {
      get: () => 200,
      configurable: true,
    });
    Object.defineProperty(mockContent, "offsetWidth", {
      get: () => 100,
      configurable: true,
    });

    const { result, rerender } = renderHook(
      ({ pps, ds }) => {
        const res = useAutoScrollAnimation(pps, ds);
        res.containerRef.current = mockContainer;
        res.contentRef.current = mockContent;
        return res;
      },
      {
        initialProps: { pps: 50, ds: 2 },
      },
    );

    act(() => {
      rerender({ pps: 50, ds: 2 });
      observerCallback([], {} as ResizeObserver);
    });

    expect(result.current.isOverflowing).toBe(false);
    expect(result.current.animationStyle).toEqual({});
    expect(result.current.delayPercent).toBe(0);
  });
});
