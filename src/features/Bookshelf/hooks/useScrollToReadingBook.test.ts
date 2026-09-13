import { error } from "@tauri-apps/plugin-log";
import { renderHook } from "@testing-library/react";
import type { GridImperativeAPI } from "react-window";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import type { GridItem } from "../utils/BookshelfUtils";
import { type ScrollToReadingBookOptions, useScrollToReadingBook } from "./useScrollToReadingBook";

describe("useScrollToReadingBook", () => {
  const books = [1, 2, 3, 4, 5].map((id) => createMockBookWithState({ id }));
  const items: GridItem[] = books.map((book) => ({ type: "book", data: book }));
  const scrollToCell = vi.fn();
  const grid = { scrollToCell } as unknown as GridImperativeAPI;

  const baseOptions = (): ScrollToReadingBookOptions => ({
    grid,
    items,
    readingBook: books[4],
    readingBookIndex: 4,
    columnCount: 2,
    gridWidth: 500,
    activeView: "bookshelf",
  });

  const setup = (overrides: Partial<ScrollToReadingBookOptions> = {}) =>
    renderHook((props: ScrollToReadingBookOptions) => useScrollToReadingBook(props), {
      initialProps: { ...baseOptions(), ...overrides },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scrolls to the reading book's cell after the grid has rendered", () => {
    setup();

    expect(scrollToCell).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(scrollToCell).toHaveBeenCalledWith({
      behavior: "instant",
      columnAlign: "smart",
      rowAlign: "smart",
      columnIndex: 0,
      rowIndex: 2,
    });
  });

  it("scrolls only once per visit, even when the items are rebuilt", () => {
    const { rerender } = setup();
    vi.runAllTimers();
    expect(scrollToCell).toHaveBeenCalledTimes(1);

    rerender({ ...baseOptions(), items: [...items] });
    vi.runAllTimers();
    expect(scrollToCell).toHaveBeenCalledTimes(1);
  });

  it("re-arms after leaving and returning to the bookshelf", () => {
    const { rerender } = setup();
    vi.runAllTimers();
    expect(scrollToCell).toHaveBeenCalledTimes(1);

    rerender({ ...baseOptions(), activeView: "reader" });
    rerender({ ...baseOptions(), activeView: "bookshelf" });
    vi.runAllTimers();
    expect(scrollToCell).toHaveBeenCalledTimes(2);
  });

  it("waits for the container to be measured before scrolling", () => {
    const { rerender } = setup({ gridWidth: 0, columnCount: 1 });
    vi.runAllTimers();
    expect(scrollToCell).not.toHaveBeenCalled();

    rerender(baseOptions());
    vi.runAllTimers();
    expect(scrollToCell).toHaveBeenCalledWith(expect.objectContaining({ rowIndex: 2 }));
  });

  it("waits for the reading book's index to resolve instead of latching", () => {
    const { rerender } = setup({ readingBookIndex: -1 });
    vi.runAllTimers();
    expect(scrollToCell).not.toHaveBeenCalled();

    rerender(baseOptions());
    vi.runAllTimers();
    expect(scrollToCell).toHaveBeenCalledTimes(1);
  });

  it("latches without scrolling when there is no reading book", () => {
    const { rerender } = setup({ readingBook: null, readingBookIndex: -1 });
    vi.runAllTimers();

    // A book opened later in the same visit does not scroll the grid.
    rerender(baseOptions());
    vi.runAllTimers();
    expect(scrollToCell).not.toHaveBeenCalled();
  });

  it("does nothing outside the bookshelf, before the grid mounts, or with no items", () => {
    setup({ activeView: "reader" });
    setup({ grid: null });
    setup({ items: [] });
    vi.runAllTimers();
    expect(scrollToCell).not.toHaveBeenCalled();
  });

  it("cancels a pending scroll when the inputs change before it fires", () => {
    const { rerender } = setup();
    rerender({ ...baseOptions(), columnCount: 3 });
    vi.runAllTimers();

    expect(scrollToCell).toHaveBeenCalledTimes(1);
    expect(scrollToCell).toHaveBeenCalledWith(
      expect.objectContaining({ columnIndex: 1, rowIndex: 1 }),
    );
  });

  it("logs a failed scroll", () => {
    scrollToCell.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    setup();
    vi.runAllTimers();

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to cell 4"));
  });
});
