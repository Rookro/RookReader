import type { ReadBook } from "../../../domain/book/schema";
import { andSearchBy } from "../../../utils/SearchUtils";

/**
 * Filters an array of ReadBook objects to find entries whose 'display_name' property contains ALL specified keywords (AND search).
 * Keywords are derived from the user's input string, separated by whitespace (including full-width spaces).
 *
 * The search is case-insensitive.
 *
 * @param entries - The array of ReadBook objects to be searched.
 * @param query - The user's input string containing one or more space-separated keywords.
 * @returns A new array containing only the ReadBook objects whose 'display_name' property matches all provided keywords.
 * Returns the original array if the query is empty or contains only whitespace.
 *
 * @example
 * const entries = [{ display_name: "test_dir", ... }, { display_name: "test_file", ... }];
 * andSearch(entries, "test file"); // Returns [{ display_name: "test_file", ... }]
 * andSearch(entries, "example"); // Returns []
 */
export const andSearch = (entries: ReadBook[], query: string) =>
  andSearchBy(entries, query, (entry) => entry.display_name);
