import { describe, it, expect } from "vitest";
import { andSearch } from "./HistoryViewerUtils";
import { ReadBook } from "../../../types/DatabaseModels";

describe("HistoryViewerUtils", () => {
  const mockEntries: ReadBook[] = [
    { id: 1, display_name: "Test Book One", path: "/path/1" } as unknown as ReadBook,
    { id: 2, display_name: "Another Book", path: "/path/2" } as unknown as ReadBook,
    { id: 3, display_name: "Test Document", path: "/path/3" } as unknown as ReadBook,
    { id: 4, display_name: "Mixed CASE Book", path: "/path/4" } as unknown as ReadBook,
  ];

  describe("andSearch", () => {
    // Verify that all entries are returned if the query is empty
    it("should return all entries if query is empty", () => {
      expect(andSearch(mockEntries, "")).toEqual(mockEntries);
      expect(andSearch(mockEntries, "   ")).toEqual(mockEntries);
    });

    // Verify that case-insensitive search is correctly performed with a single keyword
    it("should perform case-insensitive search with single keyword", () => {
      const result = andSearch(mockEntries, "test");
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual([1, 3]);

      const result2 = andSearch(mockEntries, "CASE");
      expect(result2).toHaveLength(1);
      expect(result2[0].id).toBe(4);
    });

    // Verify that AND search is correctly performed with multiple keywords
    it("should perform AND search with multiple keywords", () => {
      const result = andSearch(mockEntries, "test book");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);

      const result2 = andSearch(mockEntries, "book mixed");
      expect(result2).toHaveLength(1);
      expect(result2[0].id).toBe(4);
    });

    // Verify that full-width spaces are handled as separators for searching
    it("should handle full-width spaces as separators", () => {
      const result = andSearch(mockEntries, "test　book"); // Full-width space
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    // Verify that an empty array is returned if no match is found
    it("should return empty array if no match found", () => {
      const result = andSearch(mockEntries, "nonexistent");
      expect(result).toHaveLength(0);

      const result2 = andSearch(mockEntries, "test nonexistent");
      expect(result2).toHaveLength(0);
    });
  });
});
