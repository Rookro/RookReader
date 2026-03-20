import { describe, it, expect } from "vitest";
import { andSearch, sortBy } from "./BookshelfUtils";
import { createMockBookWithState } from "../test/factories";

describe("BookshelfUtils", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Apple Pie" }),
    createMockBookWithState({ id: 2, display_name: "Banana Bread" }),
    createMockBookWithState({ id: 3, display_name: "Apple Tart" }),
  ];

  describe("andSearch", () => {
    // Verify that all entries are returned if query is empty
    it("should return all entries if query is empty", () => {
      expect(andSearch(mockBooks, "")).toEqual(mockBooks);
    });

    // Verify that filtering by single keyword is case-insensitive
    it("should filter by single keyword (case-insensitive)", () => {
      const result = andSearch(mockBooks, "apple");
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.display_name)).toContain("Apple Pie");
      expect(result.map((b) => b.display_name)).toContain("Apple Tart");
    });

    // Verify that filtering by multiple keywords works as AND search
    it("should filter by multiple keywords (AND search)", () => {
      const result = andSearch(mockBooks, "apple pie");
      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe("Apple Pie");
    });

    // Verify that an empty array is returned if no match is found
    it("should return empty if no match", () => {
      expect(andSearch(mockBooks, "cherry")).toHaveLength(0);
    });
  });

  describe("sortBy", () => {
    const a = createMockBookWithState({ id: 1, display_name: "A" });
    const b = createMockBookWithState({ id: 2, display_name: "B" });

    // Verify correct sorting by name (ascending)
    it("should sort by NAME_ASC", () => {
      expect(sortBy(a, b, "NAME_ASC")).toBeLessThan(0);
      expect(sortBy(b, a, "NAME_ASC")).toBeGreaterThan(0);
    });

    // Verify correct sorting by name (descending)
    it("should sort by NAME_DESC", () => {
      expect(sortBy(a, b, "NAME_DESC")).toBeGreaterThan(0);
    });

    // Verify correct sorting by date (ascending)
    it("should sort by DATE_ASC", () => {
      expect(sortBy(a, b, "DATE_ASC")).toBeLessThan(0);
    });

    // Verify correct sorting by date (descending)
    it("should sort by DATE_DESC", () => {
      expect(sortBy(a, b, "DATE_DESC")).toBeGreaterThan(0);
    });
  });
});
