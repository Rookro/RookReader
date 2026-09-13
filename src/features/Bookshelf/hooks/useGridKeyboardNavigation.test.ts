import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import type { GridItem } from "../utils/BookshelfUtils";
import { useGridKeyboardNavigation } from "./useGridKeyboardNavigation";

describe("useGridKeyboardNavigation", () => {
  const books = [1, 2, 3, 4, 5].map((id) => createMockBookWithState({ id }));
  const items: GridItem[] = [
    ...books.slice(0, 4).map((book) => ({ type: "book" as const, data: book })),
    { type: "series", data: createMockSeries({ id: 10 }), books: [books[4]] },
  ];
  const onBookActivate = vi.fn();
  const onSeriesActivate = vi.fn();

  const keyEvent = (key: string) =>
    ({ key, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent;

  const setup = (overrides: Partial<Parameters<typeof useGridKeyboardNavigation>[0]> = {}) =>
    renderHook((props) => useGridKeyboardNavigation(props), {
      initialProps: { items, columnCount: 2, onBookActivate, onSeriesActivate, ...overrides },
    });

  const press = (result: ReturnType<typeof setup>["result"], key: string) => {
    const e = keyEvent(key);
    act(() => {
      result.current.handleKeyDown(e);
    });
    return e;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with nothing focused", () => {
    const { result } = setup();
    expect(result.current.focusedIndex).toBe(-1);
  });

  it("moves the focus with the arrow keys, clamped to the grid", () => {
    const { result } = setup();

    press(result, "ArrowRight");
    expect(result.current.focusedIndex).toBe(0);
    press(result, "ArrowRight");
    expect(result.current.focusedIndex).toBe(1);
    press(result, "ArrowDown");
    expect(result.current.focusedIndex).toBe(3);
    press(result, "ArrowDown");
    expect(result.current.focusedIndex).toBe(4);
    press(result, "ArrowUp");
    expect(result.current.focusedIndex).toBe(2);
    press(result, "ArrowLeft");
    expect(result.current.focusedIndex).toBe(1);
    press(result, "ArrowUp");
    expect(result.current.focusedIndex).toBe(0);
    press(result, "ArrowLeft");
    expect(result.current.focusedIndex).toBe(0);
  });

  it("jumps to the ends with Home and End", () => {
    const { result } = setup();

    press(result, "End");
    expect(result.current.focusedIndex).toBe(4);
    press(result, "Home");
    expect(result.current.focusedIndex).toBe(0);
  });

  it("activates the focused book or series with Enter and Space", () => {
    const { result } = setup();

    press(result, "ArrowRight");
    const enter = press(result, "Enter");
    expect(onBookActivate).toHaveBeenCalledWith(books[0], enter);
    expect(enter.preventDefault).toHaveBeenCalled();

    press(result, "End");
    press(result, " ");
    expect(onSeriesActivate).toHaveBeenCalledWith(10);
  });

  it("does nothing on Enter when nothing is focused, and ignores other keys", () => {
    const { result } = setup();

    const enter = press(result, "Enter");
    expect(onBookActivate).not.toHaveBeenCalled();
    expect(enter.preventDefault).not.toHaveBeenCalled();

    const other = press(result, "a");
    expect(result.current.focusedIndex).toBe(-1);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores keys when the grid is empty", () => {
    const { result } = setup({ items: [] });

    const e = press(result, "ArrowRight");
    expect(result.current.focusedIndex).toBe(-1);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it("drops the focus when the list shrinks below it", () => {
    const { result, rerender } = setup();

    press(result, "End");
    expect(result.current.focusedIndex).toBe(4);

    rerender({ items: items.slice(0, 2), columnCount: 2, onBookActivate, onSeriesActivate });
    expect(result.current.focusedIndex).toBe(-1);

    // Enter on the dropped focus must not activate anything.
    press(result, "Enter");
    expect(onBookActivate).not.toHaveBeenCalled();
  });
});
