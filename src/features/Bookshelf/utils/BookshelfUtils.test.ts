import { describe, expect, it } from "vitest";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import {
  andSearch,
  buildGridItems,
  type GridItem,
  type GridItemsParams,
  sortByGridItem,
} from "./BookshelfUtils";

describe("BookshelfUtils", () => {
  const mockBooks = [
    createMockBookWithState({ id: 1, displayName: "Apple Pie" }),
    createMockBookWithState({ id: 2, displayName: "Banana Bread" }),
    createMockBookWithState({ id: 3, displayName: "Apple Tart" }),
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
      expect(result.map((b) => b.displayName)).toContain("Apple Pie");
      expect(result.map((b) => b.displayName)).toContain("Apple Tart");
    });

    it("should filter by multiple keywords (AND search)", () => {
      const result = andSearch(mockBooks, "apple pie");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Apple Pie");
    });

    it("should filter by multiple keywords with multiple spaces", () => {
      const result = andSearch(mockBooks, "apple   pie");
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Apple Pie");
    });

    it("should return empty if no match", () => {
      expect(andSearch(mockBooks, "cherry")).toHaveLength(0);
    });
  });

  describe("sortByGridItem", () => {
    const book1 = createMockBookWithState({
      id: 1,
      displayName: "Book A",
      createdAt: "2023-11-01T00:00:00Z",
    });
    const book2 = createMockBookWithState({
      id: 2,
      displayName: "Book B",
      createdAt: "2023-12-01T00:00:00Z",
    });
    const series1 = createMockSeries({
      id: 1,
      name: "Series A",
      createdAt: "2023-01-01T00:00:00Z",
    });
    const series2 = createMockSeries({
      id: 2,
      name: "Series B",
      createdAt: "2023-01-02T00:00:00Z",
    });

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

      it("should fall back to id when book names are equal", () => {
        const x: GridItem = {
          type: "book",
          data: createMockBookWithState({ id: 1, displayName: "Same" }),
        };
        const y: GridItem = {
          type: "book",
          data: createMockBookWithState({ id: 2, displayName: "Same" }),
        };
        expect(sortByGridItem(x, y, "name_asc")).toBeLessThan(0);
        expect(sortByGridItem(x, y, "name_desc")).toBeGreaterThan(0);
      });

      // Both id orders, so neither direction can pass on the ids alone.
      it.each([
        [9, 1],
        [1, 9],
      ])(
        "should put series %i before book %i of the same name in both directions",
        (seriesId, bookId) => {
          const series: GridItem = {
            type: "series",
            data: createMockSeries({ id: seriesId, name: "Same" }),
            books: [],
          };
          const book: GridItem = {
            type: "book",
            data: createMockBookWithState({ id: bookId, displayName: "Same" }),
          };
          expect(sortByGridItem(series, book, "name_asc")).toBeLessThan(0);
          expect(sortByGridItem(series, book, "name_desc")).toBeLessThan(0);
        },
      );
    });

    describe("date sorting", () => {
      it("should sort series by date_asc", () => {
        expect(sortByGridItem(gridSeries1, gridSeries2, "date_asc")).toBeLessThan(0);
      });

      it("should sort series by date_desc", () => {
        expect(sortByGridItem(gridSeries1, gridSeries2, "date_desc")).toBeGreaterThan(0);
      });

      it("should sort books by their real createdAt (date_asc)", () => {
        // book1 createdAt 2023-11-01 is older than book2 2023-12-01.
        expect(sortByGridItem(gridBook1, gridBook2, "date_asc")).toBeLessThan(0);
      });

      it("should interleave books and series by real createdAt, not by type", () => {
        // book1 createdAt 2023-11-01 is newer than series1 2023-01-01, so the
        // older series comes first in date_asc and the newer book first in date_desc.
        expect(sortByGridItem(gridBook1, gridSeries1, "date_asc")).toBeGreaterThan(0);
        expect(sortByGridItem(gridBook1, gridSeries1, "date_desc")).toBeLessThan(0);
      });

      it("should fall back to ID if dates are equal", () => {
        const series3 = createMockSeries({
          id: 3,
          name: "Series C",
          createdAt: "2023-01-01T00:00:00Z",
        });
        const gridSeries3: GridItem = { type: "series", data: series3, books: [] };

        // gridSeries1 and gridSeries3 have same createdAt
        expect(sortByGridItem(gridSeries1, gridSeries3, "date_asc")).toBeLessThan(0); // 1 - 3
        expect(sortByGridItem(gridSeries1, gridSeries3, "date_desc")).toBeGreaterThan(0); // 3 - 1
      });

      it("should order a series before a book created later in the same second", () => {
        // The ids point the other way, so only the instants can give this order.
        const series = createMockSeries({ id: 9, name: "S", createdAt: "2023-01-01T00:00:05Z" });
        const book = createMockBookWithState({ id: 1, createdAt: "2023-01-01T00:00:05.500Z" });
        const gridSeries: GridItem = { type: "series", data: series, books: [] };
        const gridBook: GridItem = { type: "book", data: book };

        expect(sortByGridItem(gridSeries, gridBook, "date_asc")).toBeLessThan(0);
        expect(sortByGridItem(gridSeries, gridBook, "date_desc")).toBeGreaterThan(0);
      });

      // Both id orders, so neither direction can pass on the ids alone.
      it.each([
        [9, 1],
        [1, 9],
      ])(
        "should put series %i before book %i of the same createdAt in both directions",
        (seriesId, bookId) => {
          const createdAt = "2023-01-01T00:00:05Z";
          const series: GridItem = {
            type: "series",
            data: createMockSeries({ id: seriesId, name: "S", createdAt }),
            books: [],
          };
          const book: GridItem = {
            type: "book",
            data: createMockBookWithState({ id: bookId, createdAt }),
          };
          expect(sortByGridItem(series, book, "date_asc")).toBeLessThan(0);
          expect(sortByGridItem(series, book, "date_desc")).toBeLessThan(0);
        },
      );
    });
  });

  describe("buildGridItems", () => {
    const seriesA = createMockSeries({
      id: 10,
      name: "Series A",
      createdAt: "2023-01-01T00:00:00Z",
    });
    const vol2 = createMockBookWithState({
      id: 1,
      displayName: "Vol 2",
      seriesId: 10,
      seriesOrder: 2,
      tagIds: [1],
    });
    const vol1 = createMockBookWithState({
      id: 2,
      displayName: "Vol 1",
      seriesId: 10,
      seriesOrder: 1,
      tagIds: [],
    });
    const orphan = createMockBookWithState({
      id: 3,
      displayName: "Orphan",
      seriesId: 99,
      tagIds: [],
    });
    const standalone = createMockBookWithState({
      id: 4,
      displayName: "Standalone",
      seriesId: null,
      tagIds: [1],
    });

    const params: GridItemsParams = {
      books: [vol2, orphan, standalone, vol1],
      allSeries: [seriesA],
      tagId: null,
      selectedSeriesId: null,
      searchText: "",
      sortOrder: "name_asc",
    };

    const names = (items: GridItem[]) =>
      items.map((item) => (item.type === "series" ? item.data.name : item.data.displayName));

    it("groups books by series and lists them with the standalone books, sorted", () => {
      const items = buildGridItems(params);

      expect(names(items)).toEqual(["Orphan", "Series A", "Standalone"]);
      const series = items.find((item) => item.type === "series");
      expect(series?.type === "series" && series.books).toEqual([vol2, vol1]);
    });

    it("shows a book as standalone when its series is unknown", () => {
      const items = buildGridItems(params);
      expect(
        items.find((item) => item.type === "book" && item.data.id === orphan.id),
      ).toBeDefined();
    });

    it("lists only the selected series' books in series order when drilling down", () => {
      const items = buildGridItems({ ...params, selectedSeriesId: 10 });
      expect(names(items)).toEqual(["Vol 1", "Vol 2"]);
      expect(items.every((item) => item.type === "book")).toBe(true);
    });

    it("filters by tag before grouping", () => {
      const items = buildGridItems({ ...params, tagId: 1 });

      // Vol 1 has no tag, so the series only carries Vol 2.
      expect(names(items)).toEqual(["Series A", "Standalone"]);
      const series = items.find((item) => item.type === "series");
      expect(series?.type === "series" && series.books).toEqual([vol2]);
    });

    it("searches series by name rather than by volume name", () => {
      expect(names(buildGridItems({ ...params, searchText: "series" }))).toEqual(["Series A"]);
      expect(names(buildGridItems({ ...params, searchText: "vol" }))).toEqual([]);
    });

    it("searches volumes by name when drilling down", () => {
      const items = buildGridItems({ ...params, selectedSeriesId: 10, searchText: "vol 2" });
      expect(names(items)).toEqual(["Vol 2"]);
    });

    it("honours the sort order", () => {
      expect(names(buildGridItems({ ...params, sortOrder: "name_desc" }))).toEqual([
        "Standalone",
        "Series A",
        "Orphan",
      ]);
    });
  });
});
