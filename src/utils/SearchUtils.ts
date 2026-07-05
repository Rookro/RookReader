/**
 * Filters items whose name contains every whitespace-separated keyword of
 * `query` (case-insensitive AND search). Whitespace includes full-width spaces
 * (via `\s`). Returns the original array when the query is empty or blank.
 *
 * @param items - The items to filter.
 * @param query - The user's input string containing one or more keywords.
 * @param getName - Extracts the searchable name from an item.
 * @returns A new array of items whose name matches every keyword.
 *
 * @example
 * andSearchBy(books, "test file", (b) => b.display_name);
 */
export const andSearchBy = <T>(items: T[], query: string, getName: (item: T) => string): T[] => {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((keyword) => keyword.length > 0);
  if (keywords.length === 0) {
    return items;
  }
  return items.filter((item) => {
    const name = getName(item).toLowerCase();
    return keywords.every((keyword) => name.includes(keyword));
  });
};
