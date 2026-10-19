import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { clearBookmarks, fetchBookmarks } from "../bookmarkSlice";

/**
 * Keeps the bookmark list loaded for the open book.
 *
 * Mounted by the reader, which stays mounted behind the bookshelf, rather than by the
 * Bookmarks tab: the toolbar's bookmark button needs the list even while that tab is
 * closed.
 */
export function useBookmarkSync(): void {
  const dispatch = useAppDispatch();
  const bookId = useAppSelector((state) => state.read.containerFile.book?.id);

  useEffect(() => {
    if (bookId !== undefined) {
      dispatch(fetchBookmarks(bookId));
    } else {
      dispatch(clearBookmarks());
    }
  }, [dispatch, bookId]);
}
