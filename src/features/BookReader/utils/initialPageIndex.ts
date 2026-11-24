/**
 * The page index a book opens at, shared by the open and its first preload so both agree.
 *
 * The restored index is clamped so a stale `lastReadPageIndex` past the current page
 * count never strands the viewer on a blank page.
 *
 * @param pageCount - The number of pages in the book.
 * @param position - An explicit first or last page to open at, or null to restore.
 * @param lastReadPageIndex - The book's last read page, if any.
 * @returns The index to open at; 0 for a book with no pages.
 */
export const initialPageIndex = (
  pageCount: number,
  position: "first" | "last" | null,
  lastReadPageIndex: number | null | undefined,
): number => {
  if (pageCount <= 0 || position === "first") {
    return 0;
  }
  if (position === "last") {
    return pageCount - 1;
  }
  return Math.min(Math.max(0, lastReadPageIndex ?? 0), pageCount - 1);
};
