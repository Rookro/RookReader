import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDisplaySize } from "./useDisplaySize";

/** The observer callbacks ResizeObserver was constructed with, newest last. */
let observerCallbacks: ResizeObserverCallback[] = [];
let disconnectCount = 0;

/** The listeners the hook attached to the `dppx` media query, by the query it matched on. */
let mediaListeners: Array<{ query: string; listener: () => void }> = [];

/** An element reporting a fixed CSS box. */
const element = (width: number, height: number) =>
  ({ clientWidth: width, clientHeight: height }) as HTMLElement;

/** A ref holding that element, stable across renders as `useRef` is. */
const refTo = (width: number, height: number): { current: HTMLElement | null } => ({
  current: element(width, height),
});

/** Resizes the observed element in place, which is what a real resize does. */
const resize = (ref: { current: HTMLElement | null }, width: number, height: number) => {
  Object.assign(ref.current as HTMLElement, { clientWidth: width, clientHeight: height });
};

describe("useDisplaySize", () => {
  beforeEach(() => {
    observerCallbacks = [];
    disconnectCount = 0;
    mediaListeners = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observerCallbacks.push(callback);
        }
        observe() {}
        disconnect() {
          disconnectCount += 1;
        }
        unobserve() {}
      },
    );
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: (_: string, listener: () => void) => {
        mediaListeners.push({ query, listener });
      },
      removeEventListener: () => {
        mediaListeners = mediaListeners.filter((entry) => entry.query !== query);
      },
    }));
    vi.stubGlobal("devicePixelRatio", 1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports nothing until it has an element to measure", () => {
    const { result } = renderHook(() => useDisplaySize({ current: null }));
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it("measures immediately, without waiting for the debounce", () => {
    // The first measurement decides what the first page is rendered at, and the viewer
    // holds every request until it arrives.
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref));
    expect(result.current).toEqual({ width: 1024, height: 1408 });
  });

  it("rounds up to a multiple of 64", () => {
    const ref = refTo(961, 65);
    const { result } = renderHook(() => useDisplaySize(ref));

    // Up, never down: a page rounded down would be stretched to fill the viewport, which
    // is the browser upscale this whole change exists to avoid.
    expect(result.current).toEqual({ width: 1024, height: 128 });
  });

  it("measures in device pixels, not CSS pixels", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const ref = refTo(500, 700);
    const { result } = renderHook(() => useDisplaySize(ref));
    expect(result.current).toEqual({ width: 1024, height: 1408 });
  });

  it("falls back to a ratio of 1 when the browser reports none", () => {
    vi.stubGlobal("devicePixelRatio", 0);
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref));
    expect(result.current).toEqual({ width: 1024, height: 1408 });
  });

  it("debounces a resize", () => {
    vi.useFakeTimers();
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref, 150));

    resize(ref, 1200, 1400);
    act(() => {
      observerCallbacks.at(-1)?.([], {} as ResizeObserver);
    });
    // A window drag fires this on every frame; re-rendering every page at every
    // intermediate width is what the debounce is for.
    expect(result.current).toEqual({ width: 1024, height: 1408 });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toEqual({ width: 1216, height: 1408 });
  });

  it("keeps the same object when a resize lands on the same quantised size", () => {
    vi.useFakeTimers();
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref, 150));
    const first = result.current;

    // Inside the same 64 px step. Every consumer reloads the book when this object
    // changes, so an equal size must not be a new one.
    resize(ref, 1010, 1400);
    act(() => {
      observerCallbacks.at(-1)?.([], {} as ResizeObserver);
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(first);
  });

  it("re-measures when the display's scale factor changes", () => {
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref));
    expect(result.current).toEqual({ width: 1024, height: 1408 });

    // Moving the window to a display with a different scale factor changes the device
    // pixels behind an unchanged CSS box, which no ResizeObserver reports.
    expect(mediaListeners[0]?.query).toBe("(resolution: 1dppx)");
    vi.stubGlobal("devicePixelRatio", 2);
    act(() => {
      mediaListeners[0]?.listener();
    });
    expect(result.current).toEqual({ width: 2048, height: 2816 });
  });

  it("stops observing when it unmounts", () => {
    const ref = refTo(1000, 1400);
    const { unmount } = renderHook(() => useDisplaySize(ref));
    unmount();
    expect(disconnectCount).toBe(1);
    expect(mediaListeners).toHaveLength(0);
  });
});
