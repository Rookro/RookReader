import type { SortOrder } from "../../../types/AppSettings";

/**
 * Describes where the currently opened book was launched from.
 *
 * Used to resolve the "adjacent book" (next/previous) when the user pages past the
 * last/first page, so the path-aware priority (series → bookshelf → directory) can be
 * applied correctly.
 */
export type OpenOrigin =
  | { kind: "fileNavigator" }
  | { kind: "bookshelf"; bookshelfId: number | null; sortOrder: SortOrder }
  | { kind: "history" }
  | { kind: "dragDrop" }
  | { kind: "startup" };
