import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import type { GridItem } from "../components/BookGridCell";
import { useReadingBookIndex } from "./useReadingBookIndex";

describe("useReadingBookIndex", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1 }),
    createMockBookWithState({ id: 2 }),
    createMockBookWithState({ id: 3 }),
  ];

  const mockItems: GridItem[] = mockBooks.map((book) => ({
    type: "book",
    data: book,
  }));

  it("should return -1 when readingBook is null", () => {
    const { result } = renderHook(() => useReadingBookIndex(null, mockItems));
    expect(result.current).toBe(-1);
  });

  it("should find the index of the reading book", () => {
    const { result } = renderHook(() => useReadingBookIndex(mockBooks[1], mockItems));
    expect(result.current).toBe(1);
  });

  it("should return -1 if the reading book is not in items", () => {
    const otherBook = createMockBookWithState({ id: 99 });
    const { result } = renderHook(() => useReadingBookIndex(otherBook, mockItems));
    expect(result.current).toBe(-1);
  });

  it("should count series items when locating the book", () => {
    const mixedItems: GridItem[] = [
      { type: "series", data: createMockSeries({ id: 1, name: "Series 1" }), books: [] },
      { type: "book", data: mockBooks[0] },
      { type: "book", data: mockBooks[1] },
    ];
    const { result } = renderHook(() => useReadingBookIndex(mockBooks[1], mixedItems));
    expect(result.current).toBe(2);
  });

  it("should follow the reading book when it changes", () => {
    const { result, rerender } = renderHook(({ book }) => useReadingBookIndex(book, mockItems), {
      initialProps: { book: mockBooks[0] },
    });
    expect(result.current).toBe(0);

    rerender({ book: mockBooks[2] });
    expect(result.current).toBe(2);
  });
});
