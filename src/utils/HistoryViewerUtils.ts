import { HistoryEntry } from "../types/HistoryEntry";

/**
 * Filters an array of HistoryEntry objects to find entries whose 'display_name' property contains ALL specified keywords (AND search).
 * Keywords are derived from the user's input string, separated by whitespace (including full-width spaces).
 *
 * The search is case-insensitive.
 *
 * @param entries - The array of HistoryEntry objects to be searched.
 * @param query - The user's input string containing one or more space-separated keywords.
 * @returns A new array containing only the HistoryEntry objects whose 'display_name' property matches all provided keywords.
 * Returns the original array if the query is empty or contains only whitespace.
 *
 * @example
 * const entries = [{ display_name: "test_dir", ... }, { display_name: "test_file", ... }];
 * andSearch(entries, "test file"); // Returns [{ display_name: "test_file", ... }]
 * andSearch(entries, "example"); // Returns []
 */
export const andSearch = (entries: HistoryEntry[], query: string) => {
    const keywords = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(keyword => keyword.length > 0);

    if (keywords.length === 0) {
        return entries;
    }

    const filtered = entries.filter(entry => {
        const lowerCaseName = entry.display_name.toLowerCase();
        return keywords.every(keyword => {
            return lowerCaseName.includes(keyword);
        });
    });

    return filtered;
}
