import { describe, expect, it } from "vitest";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import type { GridItem } from "../components/BookGridCell";
import { andSearch, sortBy, sortByGridItem } from "./BookshelfUtils";

describe("BookshelfUtils", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Apple Pie" }),
    createMockBookWithState({ id: 2, display_name: "Banana Bread" }),
    createMockBookWithState({ id: 3, display_name: "Apple Tart" }),
  ];

  describe("andSearch", () => {
    it("should return all entries if query is empty", () => {
      expect(andSearch(mockBooks, "")).toEqual(mockBooks);
    });

    it("should return all entries if query is just whitespace", () => {
      expect(andSearch(mockBooks, "   ")).toEqual(mockBooks);
    });

    it("should filter by single keyword (case-insensitive)", () => {
      const result = andSearch(mockBooks, "apple");
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.display_name)).toContain("Apple Pie");
      expect(result.map((b) => b.display_name)).toContain("Apple Tart");
    });

    it("should filter by multiple keywords (AND search)", () => {
      const result = andSearch(mockBooks, "apple pie");
      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe("Apple Pie");
    });

    it("should filter by multiple keywords with multiple spaces", () => {
      const result = andSearch(mockBooks, "apple   pie");
      expect(result).toHaveLength(1);
      expect(result[0].display_name).toBe("Apple Pie");
    });

    it("should return empty if no match", () => {
      expect(andSearch(mockBooks, "cherry")).toHaveLength(0);
    });
  });

  describe("sortBy", () => {
    const a = createMockBookWithState({ id: 1, display_name: "A" });
    const b = createMockBookWithState({ id: 2, display_name: "B" });

    it("should sort by name_asc", () => {
      expect(sortBy(a, b, "name_asc")).toBeLessThan(0);
      expect(sortBy(b, a, "name_asc")).toBeGreaterThan(0);
    });

    it("should sort by name_desc", () => {
      expect(sortBy(a, b, "name_desc")).toBeGreaterThan(0);
    });

    it("should sort by date_asc", () => {
      expect(sortBy(a, b, "date_asc")).toBeLessThan(0);
    });

    it("should sort by date_desc", () => {
      expect(sortBy(a, b, "date_desc")).toBeGreaterThan(0);
    });
  });

  describe("sortByGridItem", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "Book A" });
    const book2 = createMockBookWithState({ id: 2, display_name: "Book B" });
    const series1 = createMockSeries({ id: 1, name: "Series A", created_at: "2023-01-01" });
    const series2 = createMockSeries({ id: 2, name: "Series B", created_at: "2023-01-02" });

    const gridBook1: GridItem = { type: "book", data: book1 };
    const gridBook2: GridItem = { type: "book", data: book2 };
    const gridSeries1: GridItem = { type: "series", data: series1, books: [] };
    const gridSeries2: GridItem = { type: "series", data: series2, books: [] };

    describe("name sorting", () => {
      it("should sort books by name_asc", () => {
        expect(sortByGridItem(gridBook1, gridBook2, "name_asc")).toBeLessThan(0);
      });

      it("should sort series by name_desc", () => {
        expect(sortByGridItem(gridSeries1, gridSeries2, "name_desc")).toBeGreaterThan(0);
      });

      it("should sort book and series by name_asc", () => {
        expect(sortByGridItem(gridBook1, gridSeries1, "name_asc")).toBeLessThan(0); // "Book A" vs "Series A"
      });
    });

    describe("date sorting", () => {
      it("should sort series by date_asc", () => {
        expect(sortByGridItem(gridSeries1, gridSeries2, "date_asc")).toBeLessThan(0);
      });

      it("should sort series by date_desc", () => {
        expect(sortByGridItem(gridSeries1, gridSeries2, "date_desc")).toBeGreaterThan(0);
      });

      it("should sort books by date_asc (using ID as proxy)", () => {
        expect(sortByGridItem(gridBook1, gridBook2, "date_asc")).toBeLessThan(0);
      });

      it("should sort series and book by date_asc", () => {
        // gridSeries1 date: "2023-01-01"
        // gridBook1 date (id 1): "0000000001"
        // "0000000001" comes before "2023-01-01"
        expect(sortByGridItem(gridBook1, gridSeries1, "date_asc")).toBeLessThan(0);
      });

      it("should fall back to ID if dates are equal", () => {
        const series3 = createMockSeries({ id: 3, name: "Series C", created_at: "2023-01-01" });
        const gridSeries3: GridItem = { type: "series", data: series3, books: [] };

        // gridSeries1 and gridSeries3 have same created_at
        expect(sortByGridItem(gridSeries1, gridSeries3, "date_asc")).toBeLessThan(0); // 1 - 3
        expect(sortByGridItem(gridSeries1, gridSeries3, "date_desc")).toBeGreaterThan(0); // 3 - 1
      });
    });
  });
});
