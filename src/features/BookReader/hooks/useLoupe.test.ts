import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoupe } from "./useLoupe";

const makeArea = (left = 10, top = 20, width = 100, height = 100) => {
  const area = document.createElement("div");
  area.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      bottom: top + height,
      right: left + width,
      x: left,
      y: top,
      toJSON: () => {},
    }) as DOMRect;
  return area;
};

describe("useLoupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useLoupe("path"));
    expect(result.current.isLoupeEnabled).toBe(false);
    expect(result.current.lens.positionRef.current).toEqual({ x: 0, y: 0 });
    expect(result.current.lens.readerSizeRef.current).toEqual({ width: 0, height: 0 });
    expect(result.current.containerRef.current).toBe(null);
  });

  it("should toggle loupe state manually", () => {
    const { result } = renderHook(() => useLoupe("path"));
    expect(result.current.isLoupeEnabled).toBe(false);

    act(() => {
      result.current.toggleLoupe();
    });
    expect(result.current.isLoupeEnabled).toBe(true);

    act(() => {
      result.current.toggleLoupe();
    });
    expect(result.current.isLoupeEnabled).toBe(false);
  });

  it("should update lens position on mouse move if enabled", () => {
    const { result } = renderHook(() => useLoupe("path"));
    result.current.containerRef.current = makeArea(10, 20, 100, 100);
    result.current.lens.drawRef.current = vi.fn();

    act(() => {
      result.current.toggleLoupe();
    });

    act(() => {
      result.current.handleMouseMove({ clientX: 50, clientY: 60 } as React.MouseEvent);
    });

    expect(result.current.lens.positionRef.current).toEqual({ x: 40, y: 40 });
  });

  it("should not update lens position on mouse move if disabled", () => {
    const { result } = renderHook(() => useLoupe("path"));
    result.current.containerRef.current = makeArea(10, 20, 100, 100);

    act(() => {
      result.current.handleMouseMove({ clientX: 50, clientY: 60 } as React.MouseEvent);
    });

    expect(result.current.lens.positionRef.current).toEqual({ x: 0, y: 0 });
  });

  it("places the loupe at the pointer when a mouse button switches it on", () => {
    const { result } = renderHook(() => useLoupe("path"));
    result.current.containerRef.current = makeArea(0, 0, 100, 100);

    act(() => {
      result.current.toggleLoupe({ clientX: 50, clientY: 50 });
    });

    expect(result.current.isLoupeEnabled).toBe(true);
    expect(result.current.lens.positionRef.current).toEqual({ x: 50, y: 50 });
  });

  it("turns off when another book opens", () => {
    const { result, rerender } = renderHook(({ path }) => useLoupe(path), {
      initialProps: { path: "a" },
    });
    result.current.containerRef.current = makeArea(0, 0, 100, 100);
    act(() => {
      result.current.toggleLoupe({ clientX: 50, clientY: 50 });
    });
    expect(result.current.lens.positionRef.current).toEqual({ x: 50, y: 50 });

    rerender({ path: "b" });

    expect(result.current.isLoupeEnabled).toBe(false);
    expect(result.current.lens.positionRef.current).toEqual({ x: 0, y: 0 });
  });

  it("reopens with one toggle after a book change", () => {
    const { result, rerender } = renderHook(({ path }) => useLoupe(path), {
      initialProps: { path: "a" },
    });
    result.current.containerRef.current = makeArea(0, 0, 100, 100);
    act(() => {
      result.current.toggleLoupe({ clientX: 50, clientY: 50 });
    });

    rerender({ path: "b" });
    act(() => {
      result.current.toggleLoupe();
    });

    expect(result.current.isLoupeEnabled).toBe(true);
    expect(result.current.lens.positionRef.current).toEqual({ x: 0, y: 0 });
  });

  // Guard: re-rendering the same book is not a book change
  it("stays on while the same book is open", () => {
    const { result, rerender } = renderHook(({ path }) => useLoupe(path), {
      initialProps: { path: "a" },
    });
    act(() => {
      result.current.toggleLoupe();
    });

    rerender({ path: "a" });

    expect(result.current.isLoupeEnabled).toBe(true);
  });
});
