import { DirEntry } from "../types/DirEntry";
import { SortOrder } from "../types/SortOrderType";

/**
 * Filters an array of DirEntry objects to find entries whose 'name' property contains ALL specified keywords (AND search).
 * Keywords are derived from the user's input string, separated by whitespace (including full-width spaces).
 *
 * The search is case-insensitive.
 *
 * @param entries - The array of DirEntry objects to be searched.
 * @param query - The user's input string containing one or more space-separated keywords.
 * @returns A new array containing only the DirEntry objects whose 'name' property matches all provided keywords.
 * Returns the original array if the query is empty or contains only whitespace.
 *
 * @example
 * const entries = [{ name: "test_dir", ... }, { name: "test_file", ... }];
 * andSearch(entries, "test file"); // Returns [{ name: "test_file", ... }]
 * andSearch(entries, "example"); // Returns []
 */
export const andSearch = (entries: DirEntry[], query: string) => {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((keyword) => keyword.length > 0);

  if (keywords.length === 0) {
    return entries;
  }

  const filtered = entries.filter((item) => {
    const lowerCaseName = item.name.toLowerCase();
    return keywords.every((keyword) => {
      return lowerCaseName.includes(keyword);
    });
  });

  return filtered;
};

/**
 * Comparison function for sorting an array of DirEntry objects based on a specified criterion and order.
 *
 * This function is designed to be passed directly to the native JavaScript Array.prototype.sort() method.
 *
 * @param a - The first DirEntry object for comparison.
 * @param b - The second DirEntry object for comparison.
 * @param sortOrder - The specified criterion (e.g., 'NAME_ASC', 'DATE_DESC') for sorting.
 * @returns A number indicating the sort order:
 * - A negative number if 'a' should come before 'b'.
 * - Zero if 'a' and 'b' are considered equal for sorting.
 * - A positive number if 'a' should come after 'b'.
 *
 * @example
 * const entries: DirEntry[] = [{ name: "b", ... }, { name: "c", ... }, { name: "a", ... }];
 * entries.sort((a, b) => sortBy(a, b, 'NAME_ASC'));  // Returns [{ name: "a", ... }, { name: "b", ... }, { name: "c", ... }]
 */
export const sortBy = (a: DirEntry, b: DirEntry, sortOrder: SortOrder) => {
  switch (sortOrder) {
    case "NAME_ASC":
      return a.name.localeCompare(b.name);
    case "NAME_DESC":
      return b.name.localeCompare(a.name);
    case "DATE_ASC":
      return Date.parse(a.last_modified) - Date.parse(b.last_modified);
    case "DATE_DESC":
      return Date.parse(b.last_modified) - Date.parse(a.last_modified);
  }
};
