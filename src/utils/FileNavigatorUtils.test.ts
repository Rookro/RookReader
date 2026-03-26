import { describe, it, expect } from "vitest";
import { andSearch, sortBy } from "./FileNavigatorUtils";
import { DirEntry } from "../types/DirEntry";

describe("FileNavigatorUtils", () => {
  const mockEntries: DirEntry[] = [
    { name: "Documents", is_directory: true, last_modified: "2023-01-01" },
    { name: "image.png", is_directory: false, last_modified: "2023-01-02" },
    { name: "data.txt", is_directory: false, last_modified: "2023-01-01" },
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
  });
});
