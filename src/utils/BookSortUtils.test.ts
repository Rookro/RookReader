import { describe, expect, it } from "vitest";
import { createMockBookWithState } from "../test/factories";
import { sortBooks, sortBySeriesOrder } from "./BookSortUtils";

describe("BookSortUtils", () => {
  describe("sortBooks", () => {
    const a = createMockBookWithState({ id: 1, displayName: "A" });
    const b = createMockBookWithState({ id: 2, displayName: "B" });

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

    it("should sort by real createdAt, not id, when dates differ", () => {
      // older has a smaller id but a newer createdAt; date order must follow the date.
      const older = createMockBookWithState({ id: 5, createdAt: "2023-11-01T00:00:00Z" });
      const newer = createMockBookWithState({ id: 4, createdAt: "2023-12-01T00:00:00Z" });
      expect(sortBooks(older, newer, "date_asc")).toBeLessThan(0);
      expect(sortBooks(older, newer, "date_desc")).toBeGreaterThan(0);
    });

    it("should fall back to id when createdAt is equal", () => {
      const x = createMockBookWithState({ id: 1, createdAt: "2023-11-01T00:00:00Z" });
      const y = createMockBookWithState({ id: 2, createdAt: "2023-11-01T00:00:00Z" });
      expect(sortBooks(x, y, "date_asc")).toBeLessThan(0);
      expect(sortBooks(x, y, "date_desc")).toBeGreaterThan(0);
    });

    it("should order a whole second before a later fraction of the same second", () => {
      // The ids point the other way, so only the instants can give this order.
      const whole = createMockBookWithState({ id: 2, createdAt: "2023-11-01T00:00:05Z" });
      const fraction = createMockBookWithState({ id: 1, createdAt: "2023-11-01T00:00:05.500Z" });
      expect(sortBooks(whole, fraction, "date_asc")).toBeLessThan(0);
      expect(sortBooks(whole, fraction, "date_desc")).toBeGreaterThan(0);
    });

    it("should treat a missing createdAt as the oldest", () => {
      const undated = createMockBookWithState({ id: 2, createdAt: null });
      const dated = createMockBookWithState({ id: 1, createdAt: "2023-11-01T00:00:00Z" });
      expect(sortBooks(undated, dated, "date_asc")).toBeLessThan(0);
      expect(sortBooks(undated, dated, "date_desc")).toBeGreaterThan(0);
    });

    it("should order a whole second before a nanosecond fraction of the same second", () => {
      // Books carry up to 9 fractional digits; the ids point the other way.
      const whole = createMockBookWithState({ id: 2, createdAt: "2023-11-01T00:00:05Z" });
      const fraction = createMockBookWithState({
        id: 1,
        createdAt: "2023-11-01T00:00:05.123456789Z",
      });
      expect(sortBooks(whole, fraction, "date_asc")).toBeLessThan(0);
      expect(sortBooks(whole, fraction, "date_desc")).toBeGreaterThan(0);
    });

    it("should treat an unparseable createdAt as the oldest", () => {
      const garbled = createMockBookWithState({ id: 2, createdAt: "not a date" });
      const dated = createMockBookWithState({ id: 1, createdAt: "2023-11-01T00:00:00Z" });
      expect(sortBooks(garbled, dated, "date_asc")).toBeLessThan(0);
      expect(sortBooks(garbled, dated, "date_desc")).toBeGreaterThan(0);
    });
  });

  describe("sortBySeriesOrder", () => {
    it("should sort by seriesOrder ascending", () => {
      const a = createMockBookWithState({ id: 1, seriesOrder: 1, displayName: "A" });
      const b = createMockBookWithState({ id: 2, seriesOrder: 2, displayName: "B" });
      expect(sortBySeriesOrder(a, b)).toBeLessThan(0);
      expect(sortBySeriesOrder(b, a)).toBeGreaterThan(0);
    });

    it("should place null seriesOrder at the end", () => {
      const a = createMockBookWithState({ id: 1, seriesOrder: 1, displayName: "A" });
      const nullBook = createMockBookWithState({ id: 2, seriesOrder: null, displayName: "B" });
      expect(sortBySeriesOrder(a, nullBook)).toBeLessThan(0);
      expect(sortBySeriesOrder(nullBook, a)).toBeGreaterThan(0);
    });

    it("should fallback to displayName ascending if both seriesOrder are null", () => {
      const a = createMockBookWithState({ id: 1, seriesOrder: null, displayName: "Apple" });
      const b = createMockBookWithState({ id: 2, seriesOrder: null, displayName: "Banana" });
      expect(sortBySeriesOrder(a, b)).toBeLessThan(0);
      expect(sortBySeriesOrder(b, a)).toBeGreaterThan(0);
    });

    it("should fallback to displayName ascending if seriesOrders are equal", () => {
      const a = createMockBookWithState({ id: 1, seriesOrder: 1, displayName: "Apple" });
      const b = createMockBookWithState({ id: 2, seriesOrder: 1, displayName: "Banana" });
      expect(sortBySeriesOrder(a, b)).toBeLessThan(0);
      expect(sortBySeriesOrder(b, a)).toBeGreaterThan(0);
    });
  });
});
