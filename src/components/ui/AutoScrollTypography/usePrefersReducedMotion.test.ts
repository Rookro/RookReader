import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** Installs a matchMedia stub and returns a handle to flip the query result. */
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: initialMatches,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };

  const matchMedia = vi.fn(() => mediaQuery);
  vi.stubGlobal("matchMedia", matchMedia);

  return {
    matchMedia,
    set(matches: boolean) {
      mediaQuery.matches = matches;
      for (const listener of listeners) listener();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should report the current preference", () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
  });

  it("should update when the preference changes", () => {
    const media = stubMatchMedia(false);

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      media.set(true);
    });

    expect(result.current).toBe(true);
  });

  it("should query matchMedia once no matter how many callers subscribe", () => {
    const media = stubMatchMedia(false);

    const { unmount } = renderHook(() => {
      usePrefersReducedMotion();
      usePrefersReducedMotion();
      usePrefersReducedMotion();
    });

    expect(media.matchMedia).toHaveBeenCalledTimes(1);
    expect(media.listenerCount).toBe(1);

    unmount();

    expect(media.listenerCount).toBe(0);
  });

  it("should fall back to false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });
});
