import type { BookWithState } from "../../../domain/book/schema";
import type { Series } from "../../../domain/series/schema";
import type { SortOrder } from "../../../types/AppSettings";
import { andSearchBy } from "../../../utils/SearchUtils";

/** Represents an item that can be displayed in the book grid. */
export type GridItem =
  | { type: "book"; data: BookWithState }
  | { type: "series"; data: Series; books: BookWithState[] };

/**
 * Filters an array of BookWithState objects to find entries whose 'display_name' property contains ALL specified keywords (AND search).
 * Keywords are derived from the user's input string, separated by whitespace (including full-width spaces).
 *
 * The search is case-insensitive.
 *
 * @param entries - The array of BookWithState objects to be searched.
 * @param query - The user's input string containing one or more space-separated keywords.
 * @returns A new array containing only the BookWithState objects whose 'display_name' property matches all provided keywords.
 * Returns the original array if the query is empty or contains only whitespace.
 *
 * @example
 * const entries = [{ display_name: "test_dir", ... }, { display_name: "test_file", ... }];
 * andSearch(entries, "test file"); // Returns [{ display_name: "test_file", ... }]
 * andSearch(entries, "example"); // Returns []
 */
export const andSearch = (entries: BookWithState[], query: string) =>
  andSearchBy(entries, query, (entry) => entry.display_name);

/**
 * Filters an array of GridItem objects based on their names.
 * For 'book' items, it checks 'display_name'.
 * For 'series' items, it checks the series 'name'.
 *
 * @param items - The array of GridItem objects to be searched.
 * @param query - The space-separated keywords for AND search.
 * @returns A filtered array of GridItem objects.
 */
export const andSearchGridItems = (items: GridItem[], query: string) =>
  andSearchBy(items, query, (item) =>
    item.type === "series" ? item.data.name : item.data.display_name,
  );

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
 * books.sort((a, b) => sortBy(a, b, 'name_asc'));  // Returns [{ name: "a", ... }, { name: "b", ... }, { name: "c", ... }]
 */
export const sortBy = (a: BookWithState, b: BookWithState, sortOrder: SortOrder) => {
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

/**
 * Comparison function for sorting an array of GridItem objects based on a specified criterion and order.
 *
 * @param a - The first GridItem for comparison.
 * @param b - The second GridItem for comparison.
 * @param sortOrder - The specified criterion for sorting.
 * @returns A number indicating the sort order.
 */
export const sortByGridItem = (a: GridItem, b: GridItem, sortOrder: SortOrder) => {
  const getComparisonValues = (item: GridItem) => {
    if (item.type === "series") {
      return {
        name: item.data.name,
        date: item.data.created_at,
        id: item.data.id,
      };
    }
    return {
      name: item.data.display_name,
      // Both series and standalone books now carry a real ISO `created_at`, so they
      // interleave by actual creation date. Fall back to an empty string when absent.
      date: item.data.created_at ?? "",
      id: item.data.id,
    };
  };

  const valA = getComparisonValues(a);
  const valB = getComparisonValues(b);

  switch (sortOrder) {
    case "name_asc":
      return valA.name.localeCompare(valB.name);
    case "name_desc":
      return valB.name.localeCompare(valA.name);
    case "date_asc":
      return valA.date.localeCompare(valB.date) || valA.id - valB.id;
    case "date_desc":
      return valB.date.localeCompare(valA.date) || valB.id - valA.id;
  }
};

/** The inputs that decide what the book grid shows. */
export interface GridItemsParams {
  /** The books of the selected bookshelf. */
  books: BookWithState[];
  /** Every series, to group books by. */
  allSeries: Series[];
  /** The selected tag, or null for no tag filter. */
  tagId: number | null;
  /** The series being drilled into, or null for the main bookshelf. */
  selectedSeriesId: number | null;
  /** The search box text. */
  searchText: string;
  /** The sort order of the main bookshelf. */
  sortOrder: SortOrder;
}

/**
 * Builds the grid items: books grouped into series, filtered by tag and search text, sorted.
 *
 * In drill-down mode (a series is selected) only that series' books are shown, in series
 * order. Otherwise books are grouped by series before searching, so a series matches by
 * its own name rather than by its volumes' names.
 *
 * @param params - The inputs that decide what the grid shows.
 * @returns The items in display order.
 */
export const buildGridItems = ({
  books,
  allSeries,
  tagId,
  selectedSeriesId,
  searchText,
  sortOrder,
}: GridItemsParams): GridItem[] => {
  // Filter books based on selected tag
  const taggedBooks = tagId === null ? books : books.filter((book) => book.tag_ids.includes(tagId));

  // Drill-down mode logic: if a series is selected, show only books in that series
  if (selectedSeriesId !== null) {
    return andSearch(taggedBooks, searchText)
      .filter((book) => book.series_id === selectedSeriesId)
      .sort(sortBySeriesOrder)
      .map((book) => ({ type: "book" as const, data: book }));
  }

  // Main Bookshelf logic: Group books by series_id BEFORE searching
  const seriesMap = new Map<number, BookWithState[]>();
  const standaloneBooks: BookWithState[] = [];

  taggedBooks.forEach((book) => {
    if (book.series_id !== null) {
      if (!seriesMap.has(book.series_id)) {
        seriesMap.set(book.series_id, []);
      }
      seriesMap.get(book.series_id)?.push(book);
    } else {
      standaloneBooks.push(book);
    }
  });

  const groupedItems: GridItem[] = [];

  // Index series by id once, instead of an O(S) find per grouped series (O(S²)).
  const seriesById = new Map(allSeries.map((s) => [s.id, s]));

  // Add series items
  seriesMap.forEach((booksInSeries, id) => {
    const seriesObj = seriesById.get(id);
    if (seriesObj) {
      groupedItems.push({ type: "series", data: seriesObj, books: booksInSeries });
    } else {
      // Fallback for missing series data
      booksInSeries.forEach((book) => {
        standaloneBooks.push(book);
      });
    }
  });

  // Add standalone book items
  standaloneBooks.forEach((book) => {
    groupedItems.push({ type: "book", data: book });
  });

  // Perform search on the grouped items (Search by Series name or Standalone Book name)
  const searchedItems = andSearchGridItems(groupedItems, searchText);

  // Sort the final list
  return searchedItems.sort((a, b) => sortByGridItem(a, b, sortOrder));
};
