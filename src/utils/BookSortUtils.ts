import type { BookWithState } from "../domain/entities";
import type { SortOrder } from "../types/AppSettings";

/**
 * Comparison function for sorting an array of BookWithState objects based on a specified criterion and order.
 *
 * This function is designed to be passed directly to the native JavaScript Array.prototype.sort() method.
 *
 * @param a - The first BookWithState object for comparison.
 * @param b - The second BookWithState object for comparison.
 * @param sortOrder - The specified criterion (e.g., 'name_asc', 'date_desc') for sorting.
 * @returns A number indicating the sort order:
 * - A negative number if 'a' should come before 'b'.
 * - Zero if 'a' and 'b' are considered equal for sorting.
 * - A positive number if 'a' should come after 'b'.
 *
 * @example
 * const books: BookWithState[] = [{ name: "b", ... }, { name: "c", ... }, { name: "a", ... }];
 * books.sort((a, b) => sortBooks(a, b, 'name_asc'));  // Returns [{ name: "a", ... }, { name: "b", ... }, { name: "c", ... }]
 */
export const sortBooks = (a: BookWithState, b: BookWithState, sortOrder: SortOrder) => {
  switch (sortOrder) {
    case "name_asc":
      return a.display_name.localeCompare(b.display_name);
    case "name_desc":
      return b.display_name.localeCompare(a.display_name);
    case "date_asc":
      // Sort by the real creation timestamp (ISO string), falling back to id so the
      // order stays consistent with the bookshelf grid and adjacent-book navigation.
      return (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id - b.id;
    case "date_desc":
      return (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id - a.id;
  }
};

/**
 * Comparison function for sorting an array of BookWithState objects by their series_order.
 * Books with null series_order are placed at the end.
 * Fallback to display_name (locale-aware) if both have null or the same series_order.
 *
 * @param a - The first BookWithState object for comparison.
 * @param b - The second BookWithState object for comparison.
 * @returns A number indicating the sort order.
 */
export const sortBySeriesOrder = (a: BookWithState, b: BookWithState) => {
  if (a.series_order !== null && b.series_order !== null) {
    if (a.series_order !== b.series_order) {
      return a.series_order - b.series_order;
    }
  } else if (a.series_order !== null && b.series_order === null) {
    return -1; // a comes first
  } else if (a.series_order === null && b.series_order !== null) {
    return 1; // b comes first
  }

  // Fallback: name_asc
  return a.display_name.localeCompare(b.display_name);
};
