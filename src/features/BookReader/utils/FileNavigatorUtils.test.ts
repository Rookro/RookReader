import { describe, expect, it } from "vitest";
import type { DirEntry } from "../../../domain/entities";
import { andSearch, sortBy } from "./FileNavigatorUtils";

describe("FileNavigatorUtils", () => {
  const mockEntries: DirEntry[] = [
    { name: "Documents", isDirectory: true, lastModified: Date.parse("2023-01-01") },
    { name: "image.png", isDirectory: false, lastModified: Date.parse("2023-01-02") },
    { name: "data.txt", isDirectory: false, lastModified: Date.parse("2023-01-01") },
  ];

  describe("andSearch", () => {
    // Verify that filtering by keyword is performed correctly
    it("should filter by keyword", () => {
      const result = andSearch(mockEntries, "doc");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Documents");
    });

    // Verify that filtering by multiple words (AND search) is performed correctly
    it("should handle multi-word search", () => {
      const result = andSearch(mockEntries, "image png");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("image.png");
    });

    // Verify that all entries are returned if the query is empty
    it("should return all entries for an empty query", () => {
      const result = andSearch(mockEntries, "");
      expect(result).toHaveLength(mockEntries.length);
    });

    // Verify that all entries are returned if the query consists only of whitespace
    it("should return all entries for a whitespace query", () => {
      const result = andSearch(mockEntries, "   ");
      expect(result).toHaveLength(mockEntries.length);
    });

    // Verify that searching (filtering) is case-insensitive
    it("should be case-insensitive", () => {
      const result = andSearch(mockEntries, "DOCUMENTS");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Documents");
    });
  });

  describe("sortBy", () => {
    // Verify correct sorting by name (ascending)
    it("should sort by name ascending", () => {
      const sorted = [...mockEntries].sort((a, b) => sortBy(a, b, "name_asc"));
      expect(sorted[0].name).toBe("data.txt");
      expect(sorted[2].name).toBe("image.png");
    });

    // Verify correct sorting by name (descending)
    it("should sort by name descending", () => {
      const sorted = [...mockEntries].sort((a, b) => sortBy(a, b, "name_desc"));
      expect(sorted[0].name).toBe("image.png");
      expect(sorted[2].name).toBe("data.txt");
    });

    // Verify correct sorting by date (ascending)
    it("should sort by date ascending", () => {
      const sorted = [...mockEntries].sort((a, b) => sortBy(a, b, "date_asc"));
      expect(sorted[0].name).toBe("Documents"); // 2023-01-01
      expect(sorted[1].name).toBe("data.txt"); // 2023-01-01
      expect(sorted[2].name).toBe("image.png"); // 2023-01-02
    });

    // Verify correct sorting by date (descending)
    it("should sort by date descending", () => {
      const sorted = [...mockEntries].sort((a, b) => sortBy(a, b, "date_desc"));
      expect(sorted[0].name).toBe("image.png");
    });

    // Regression: raw numeric timestamps must be compared numerically, not parsed as date strings.
    it("should order raw numeric timestamps numerically", () => {
      const numericEntries: DirEntry[] = [
        { name: "c", isDirectory: false, lastModified: 3000 },
        { name: "a", isDirectory: false, lastModified: 1000 },
        { name: "b", isDirectory: false, lastModified: 2000 },
      ];
      const asc = [...numericEntries].sort((a, b) => sortBy(a, b, "date_asc"));
      expect(asc.map((e) => e.lastModified)).toEqual([1000, 2000, 3000]);
      const desc = [...numericEntries].sort((a, b) => sortBy(a, b, "date_desc"));
      expect(desc.map((e) => e.lastModified)).toEqual([3000, 2000, 1000]);
    });
  });
});
