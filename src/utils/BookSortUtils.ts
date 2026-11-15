import type { BookWithState } from "../domain/entities";
import type { SortOrder } from "../types/AppSettings";

/** The instant of a creation timestamp; a missing or unparseable one counts as the oldest. */
const createdAtMs = (createdAt: string | null | undefined) => {
  const ms = createdAt ? Date.parse(createdAt) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Compares two creation timestamps as instants, to the millisecond, oldest first.
 *
 * The backend sends whole seconds for some rows and fractional seconds for others
 * (`…05Z`, `…05.5Z`), which do not order as strings. A missing or unparseable timestamp
 * counts as the oldest.
 *
 * @param a - The first timestamp (RFC 3339), if any.
 * @param b - The second timestamp (RFC 3339), if any.
 * @returns A negative number when `a` is older, a positive one when it is newer, zero when
 * both fall in the same millisecond.
 */
export const compareCreatedAt = (a: string | null | undefined, b: string | null | undefined) =>
  createdAtMs(a) - createdAtMs(b);

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
      return a.displayName.localeCompare(b.displayName) || a.id - b.id;
    case "name_desc":
      return b.displayName.localeCompare(a.displayName) || b.id - a.id;
    case "date_asc":
      // Sort by the real creation timestamp, falling back to id so the
      // order stays consistent with the bookshelf grid and adjacent-book navigation.
      return compareCreatedAt(a.createdAt, b.createdAt) || a.id - b.id;
    case "date_desc":
      return compareCreatedAt(b.createdAt, a.createdAt) || b.id - a.id;
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
