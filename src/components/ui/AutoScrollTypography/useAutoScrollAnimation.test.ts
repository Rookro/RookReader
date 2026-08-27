import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScrollAnimation } from "./useAutoScrollAnimation";

/** Installs a matchMedia stub and returns a handle to flip the query result. */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: initialMatches,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQuery),
  );

  return {
    set(matches: boolean) {
      mediaQuery.matches = matches;
      for (const listener of listeners) listener();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

/** Mounts the hook against elements whose measured widths overflow. */
function renderOverflowing(enabled = true) {
  const container = document.createElement("div");
  const content = document.createElement("span");
  container.appendChild(content);
  document.body.appendChild(container);

  Object.defineProperty(container, "clientWidth", { get: () => 100, configurable: true });
  Object.defineProperty(content, "offsetWidth", { get: () => 200, configurable: true });

  return renderHook(() => {
    const result = useAutoScrollAnimation(enabled, 50, 2);
    result.containerRef.current = container;
    result.contentRef.current = content;
    return result;
  });
}

describe("useAutoScrollAnimation", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("should return idle state before anything is measured", () => {
    const { result } = renderHook(() => useAutoScrollAnimation(true, 50, 2));

    expect(result.current.isOverflowing).toBe(false);
    expect(result.current.shouldAnimate).toBe(false);
    expect(result.current.metrics).toBeNull();
    expect(result.current.containerRef.current).toBeNull();
    expect(result.current.contentRef.current).toBeNull();
    expect(result.current.scrollRef.current).toBeNull();
  });

  it("should expose the cycle timing derived from the measured width", () => {
    const { result, rerender } = renderOverflowing();

    // The refs are only populated by the first render, so measure on the second.
    act(() => {
      rerender();
    });

    expect(result.current.isOverflowing).toBe(true);
    expect(result.current.shouldAnimate).toBe(true);
    expect(result.current.metrics).toEqual({
      contentWidth: 200,
      durationMs: 6000,
      delayFraction: expect.closeTo(1 / 3, 5),
    });
  });

  it("should not animate when the user prefers reduced motion", () => {
    stubMatchMedia(true);

    const { result, rerender } = renderOverflowing();
    act(() => {
      rerender();
    });

    expect(result.current.isOverflowing).toBe(true);
    expect(result.current.shouldAnimate).toBe(false);
  });

  it("should stop animating when the reduced motion preference turns on", () => {
    const media = stubMatchMedia(false);

    const { result, rerender } = renderOverflowing();
    act(() => {
      rerender();
    });
    expect(result.current.shouldAnimate).toBe(true);

    act(() => {
      media.set(true);
    });

    expect(result.current.shouldAnimate).toBe(false);
  });

  it("should register a single reduced motion listener for many instances", () => {
    const media = stubMatchMedia(false);

    const { unmount } = renderHook(() => {
      useAutoScrollAnimation(true, 50, 2);
      useAutoScrollAnimation(true, 50, 2);
      useAutoScrollAnimation(true, 50, 2);
    });

    expect(media.listenerCount).toBe(1);

    unmount();

    expect(media.listenerCount).toBe(0);
  });
});
