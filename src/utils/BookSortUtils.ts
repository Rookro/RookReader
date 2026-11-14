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
      return a.displayName.localeCompare(b.displayName);
    case "name_desc":
      return b.displayName.localeCompare(a.displayName);
    case "date_asc":
      // Sort by the real creation timestamp (ISO string), falling back to id so the
      // order stays consistent with the bookshelf grid and adjacent-book navigation.
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id - b.id;
    case "date_desc":
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id - a.id;
  }
};

/**
 * Comparison function for sorting an array of BookWithState objects by their seriesOrder.
 * Books with null seriesOrder are placed at the end.
 * Fallback to displayName (locale-aware) if both have null or the same seriesOrder.
 *
 * @param a - The first BookWithState object for comparison.
 * @param b - The second BookWithState object for comparison.
 * @returns A number indicating the sort order.
 */
export const sortBySeriesOrder = (a: BookWithState, b: BookWithState) => {
  if (a.seriesOrder !== null && b.seriesOrder !== null) {
    if (a.seriesOrder !== b.seriesOrder) {
      return a.seriesOrder - b.seriesOrder;
    }
  } else if (a.seriesOrder !== null && b.seriesOrder === null) {
    return -1; // a comes first
  } else if (a.seriesOrder === null && b.seriesOrder !== null) {
    return 1; // b comes first
  }

  // Fallback: name_asc
  return a.displayName.localeCompare(b.displayName);
};
