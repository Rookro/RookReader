import { describe, expect, it } from "vitest";
import { initialPageIndex } from "./initialPageIndex";

describe("initialPageIndex", () => {
  it("opens a book with no pages at 0", () => {
    expect(initialPageIndex(0, "last", 5)).toBe(0);
    expect(initialPageIndex(0, null, 5)).toBe(0);
  });

  it("opens at the first or the last page when asked to", () => {
    expect(initialPageIndex(6, "first", 4)).toBe(0);
    expect(initialPageIndex(6, "last", 1)).toBe(5);
  });

  it("restores the last read page, clamped to the book", () => {
    expect(initialPageIndex(6, null, 4)).toBe(4);
    expect(initialPageIndex(3, null, 10)).toBe(2);
    expect(initialPageIndex(3, null, -1)).toBe(0);
    expect(initialPageIndex(3, null, undefined)).toBe(0);
    expect(initialPageIndex(3, null, null)).toBe(0);
  });
});
