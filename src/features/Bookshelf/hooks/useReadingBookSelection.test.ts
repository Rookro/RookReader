import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import type { GridItem } from "../components/BookGridCell";
import { useReadingBookSelection } from "./useReadingBookSelection";

describe("useReadingBookSelection", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1 }),
    createMockBookWithState({ id: 2 }),
    createMockBookWithState({ id: 3 }),
  ];

  const mockItems: GridItem[] = mockBooks.map((book) => ({
    type: "book",
    data: book,
  }));

  it("should set index to -1 when readingBook is null", async () => {
    const setReadingBookIndex = vi.fn();
    renderHook(() => useReadingBookSelection(null, mockItems, setReadingBookIndex));

    await waitFor(() => {
      expect(setReadingBookIndex).toHaveBeenCalledWith(-1);
    });
  });

  it("should find the index of the reading book", async () => {
    const setReadingBookIndex = vi.fn();
    const readingBook = mockBooks[1];
    renderHook(() => useReadingBookSelection(readingBook, mockItems, setReadingBookIndex));

    await waitFor(() => {
      expect(setReadingBookIndex).toHaveBeenCalledWith(1);
    });
  });

  it("should set index to -1 if reading book is not in items", async () => {
    const setReadingBookIndex = vi.fn();
    const otherBook = createMockBookWithState({ id: 99 });
    renderHook(() => useReadingBookSelection(otherBook, mockItems, setReadingBookIndex));

    await waitFor(() => {
      expect(setReadingBookIndex).toHaveBeenCalledWith(-1);
    });
  });

  it("should handle mixed items (books and series)", async () => {
    const mixedItems: GridItem[] = [
      { type: "series", data: createMockSeries({ id: 1, name: "Series 1" }), books: [] },
      { type: "book", data: mockBooks[0] },
      { type: "book", data: mockBooks[1] },
    ];
    const setReadingBookIndex = vi.fn();
    const readingBook = mockBooks[1];
    renderHook(() => useReadingBookSelection(readingBook, mixedItems, setReadingBookIndex));

    await waitFor(() => {
      expect(setReadingBookIndex).toHaveBeenCalledWith(2);
    });
  });

  it("should update index when items change", async () => {
    const setReadingBookIndex = vi.fn();
    const readingBook = mockBooks[1];
    const { rerender } = renderHook(
      ({ items }) => useReadingBookSelection(readingBook, items, setReadingBookIndex),
      {
        initialProps: { items: mockItems },
      },
    );

    await waitFor(() => {
      expect(setReadingBookIndex).toHaveBeenCalledWith(1);
    });

    const newItems: GridItem[] = [mockItems[1], mockItems[0], mockItems[2]];
    rerender({ items: newItems });

    await waitFor(() => {
      expect(setReadingBookIndex).toHaveBeenCalledWith(0);
    });
  });
});
