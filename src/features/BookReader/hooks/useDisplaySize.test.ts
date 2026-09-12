import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDisplaySize } from "./useDisplaySize";

/** The observer callbacks ResizeObserver was constructed with, newest last. */
let observerCallbacks: ResizeObserverCallback[] = [];
let disconnectCount = 0;

/** The listeners the hook attached to the `dppx` media query, by the query it matched on. */
let mediaListeners: Array<{ query: string; listener: () => void }> = [];

/** An element reporting a fixed CSS box, fractional as a laid-out box can be. */
const element = (width: number, height: number) =>
  ({ getBoundingClientRect: () => ({ width, height }) }) as unknown as HTMLElement;

/** A ref holding that element, stable across renders as `useRef` is. */
const refTo = (width: number, height: number): { current: HTMLElement | null } => ({
  current: element(width, height),
});

/** Resizes the observed element in place, which is what a real resize does. */
const resize = (ref: { current: HTMLElement | null }, width: number, height: number) => {
  Object.assign(ref.current as HTMLElement, { getBoundingClientRect: () => ({ width, height }) });
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
    expect(result.current).toEqual({ width: 1000, height: 1400 });
  });

  it("reports the box to the pixel, not rounded to a coarser step", () => {
    const ref = refTo(999.6, 1399.5);
    const { result } = renderHook(() => useDisplaySize(ref));

    // A page rendered even a few percent larger than its box is scaled by the browser at
    // a ratio just under 1, which on a screentone is a beat: bands of rising and falling
    // contrast every few dozen pixels. To the pixel, the same drift spans the whole page.
    expect(result.current).toEqual({ width: 1000, height: 1400 });
  });

  it("measures in device pixels, not CSS pixels", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const ref = refTo(500, 700);
    const { result } = renderHook(() => useDisplaySize(ref));
    expect(result.current).toEqual({ width: 1000, height: 1400 });
  });

  it("falls back to a ratio of 1 when the browser reports none", () => {
    vi.stubGlobal("devicePixelRatio", 0);
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref));
    expect(result.current).toEqual({ width: 1000, height: 1400 });
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
    expect(result.current).toEqual({ width: 1000, height: 1400 });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toEqual({ width: 1200, height: 1400 });
  });

  it("keeps the same object when a resize lands on the same size", () => {
    vi.useFakeTimers();
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref, 150));
    const first = result.current;

    // A sub-pixel nudge rounds to the size already reported. Every consumer reloads the
    // book when this object changes, so an equal size must not be a new one.
    resize(ref, 1000.4, 1400);
    act(() => {
      observerCallbacks.at(-1)?.([], {} as ResizeObserver);
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(first);
  });

  it("re-measures when the display's scale factor changes", () => {
    vi.useFakeTimers();
    const ref = refTo(1000, 1400);
    const { result } = renderHook(() => useDisplaySize(ref, 150));
    expect(result.current).toEqual({ width: 1000, height: 1400 });

    // Moving the window to a display with a different scale factor changes the device
    // pixels behind an unchanged CSS box, which no ResizeObserver reports.
    expect(mediaListeners[0]?.query).toBe("(resolution: 1dppx)");
    vi.stubGlobal("devicePixelRatio", 2);
    act(() => {
      mediaListeners[0]?.listener();
    });
    expect(mediaListeners.at(-1)?.query).toBe("(resolution: 2dppx)");
    // Settled like a resize, because the OS resizes the window along with it.
    expect(result.current).toEqual({ width: 1000, height: 1400 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toEqual({ width: 2000, height: 2800 });
  });

  it("reports a scale-factor change and the resize that comes with it once", () => {
    vi.useFakeTimers();
    const ref = refTo(1000, 1400);
    const reported: unknown[] = [];
    renderHook(() => {
      const size = useDisplaySize(ref, 150);
      reported.push(size);
      return size;
    });
    const measuredOnce = new Set(reported).size;

    // The OS resizes the window as it moves to the other display. Two reports here are
    // two reloads of every page on screen, the first of them for a size nobody sees.
    vi.stubGlobal("devicePixelRatio", 2);
    act(() => {
      mediaListeners[0]?.listener();
    });
    resize(ref, 800, 1100);
    act(() => {
      observerCallbacks.at(-1)?.([], {} as ResizeObserver);
      vi.advanceTimersByTime(150);
    });

    expect(new Set(reported).size).toBe(measuredOnce + 1);
    expect(reported.at(-1)).toEqual({ width: 1600, height: 2200 });
  });

  it("stops observing when it unmounts", () => {
    const ref = refTo(1000, 1400);
    const { unmount } = renderHook(() => useDisplaySize(ref));
    unmount();
    expect(disconnectCount).toBe(1);
    expect(mediaListeners).toHaveLength(0);
  });
});
