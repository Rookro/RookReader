import { describe, expect, it } from "vitest";
import { createMockBookWithState } from "../test/factories";
import { sortBooks, sortBySeriesOrder } from "./BookSortUtils";

describe("BookSortUtils", () => {
  describe("sortBooks", () => {
    const a = createMockBookWithState({ id: 1, display_name: "A" });
    const b = createMockBookWithState({ id: 2, display_name: "B" });

    it("should sort by name_asc", () => {
      expect(sortBooks(a, b, "name_asc")).toBeLessThan(0);
      expect(sortBooks(b, a, "name_asc")).toBeGreaterThan(0);
    });

    it("should sort by name_desc", () => {
      expect(sortBooks(a, b, "name_desc")).toBeGreaterThan(0);
    });

    it("should sort by date_asc", () => {
      expect(sortBooks(a, b, "date_asc")).toBeLessThan(0);
    });

    it("should sort by date_desc", () => {
      expect(sortBooks(a, b, "date_desc")).toBeGreaterThan(0);
    });

    it("should sort by real created_at, not id, when dates differ", () => {
      // older has a smaller id but a newer created_at; date order must follow the date.
      const older = createMockBookWithState({ id: 5, created_at: "2023-11-01" });
      const newer = createMockBookWithState({ id: 4, created_at: "2023-12-01" });
      expect(sortBooks(older, newer, "date_asc")).toBeLessThan(0);
      expect(sortBooks(older, newer, "date_desc")).toBeGreaterThan(0);
    });

    it("should fall back to id when created_at is equal", () => {
      const x = createMockBookWithState({ id: 1, created_at: "2023-11-01" });
      const y = createMockBookWithState({ id: 2, created_at: "2023-11-01" });
      expect(sortBooks(x, y, "date_asc")).toBeLessThan(0);
      expect(sortBooks(x, y, "date_desc")).toBeGreaterThan(0);
    });
  });

  describe("sortBySeriesOrder", () => {
    it("should sort by series_order ascending", () => {
      const a = createMockBookWithState({ id: 1, series_order: 1, display_name: "A" });
      const b = createMockBookWithState({ id: 2, series_order: 2, display_name: "B" });
      expect(sortBySeriesOrder(a, b)).toBeLessThan(0);
      expect(sortBySeriesOrder(b, a)).toBeGreaterThan(0);
    });

    it("should place null series_order at the end", () => {
      const a = createMockBookWithState({ id: 1, series_order: 1, display_name: "A" });
      const nullBook = createMockBookWithState({ id: 2, series_order: null, display_name: "B" });
      expect(sortBySeriesOrder(a, nullBook)).toBeLessThan(0);
      expect(sortBySeriesOrder(nullBook, a)).toBeGreaterThan(0);
    });

    it("should fallback to display_name ascending if both series_order are null", () => {
      const a = createMockBookWithState({ id: 1, series_order: null, display_name: "Apple" });
      const b = createMockBookWithState({ id: 2, series_order: null, display_name: "Banana" });
      expect(sortBySeriesOrder(a, b)).toBeLessThan(0);
      expect(sortBySeriesOrder(b, a)).toBeGreaterThan(0);
    });

    it("should fallback to display_name ascending if series_orders are equal", () => {
      const a = createMockBookWithState({ id: 1, series_order: 1, display_name: "Apple" });
      const b = createMockBookWithState({ id: 2, series_order: 1, display_name: "Banana" });
      expect(sortBySeriesOrder(a, b)).toBeLessThan(0);
      expect(sortBySeriesOrder(b, a)).toBeGreaterThan(0);
    });
  });
});
