import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useContextMenuAnchor } from "./useContextMenuAnchor";

describe("useContextMenuAnchor", () => {
  const rightClick = (x: number, y: number) =>
    ({
      clientX: x,
      clientY: y,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }) as unknown as React.MouseEvent;

  it("starts closed", () => {
    const { result } = renderHook(() => useContextMenuAnchor());
    expect(result.current.anchor).toBeNull();
  });

  it("opens at the pointer and swallows the native menu", () => {
    const { result } = renderHook(() => useContextMenuAnchor());
    const e = rightClick(12, 34);

    act(() => {
      result.current.open(e);
    });

    expect(result.current.anchor).toEqual({ mouseX: 12, mouseY: 34 });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it("moves to a new pointer position when opened again", () => {
    const { result } = renderHook(() => useContextMenuAnchor());

    act(() => {
      result.current.open(rightClick(1, 2));
    });
    act(() => {
      result.current.open(rightClick(5, 6));
    });

    expect(result.current.anchor).toEqual({ mouseX: 5, mouseY: 6 });
  });

  it("closes", () => {
    const { result } = renderHook(() => useContextMenuAnchor());

    act(() => {
      result.current.open(rightClick(1, 2));
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.anchor).toBeNull();
  });

  it("keeps stable open/close callbacks across renders", () => {
    const { result, rerender } = renderHook(() => useContextMenuAnchor());
    const { open, close } = result.current;

    rerender();

    expect(result.current.open).toBe(open);
    expect(result.current.close).toBe(close);
  });
});
