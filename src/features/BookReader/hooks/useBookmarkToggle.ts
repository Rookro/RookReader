import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Bookmark } from "../../../domain/entities";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { addBookmark, removeBookmark } from "../bookmarkSlice";

/**
 * The bookmark at the current position, and a toggle that adds or removes it.
 *
 * @returns `currentBookmark` (undefined when the position is not bookmarked or the list is not
 * ready), `isReady` (the open book's list has loaded), and `toggle`, which does nothing until
 * the list is ready.
 */
export const useBookmarkToggle = (): {
  currentBookmark: Bookmark | undefined;
  isReady: boolean;
  toggle: () => void;
} => {
  const { t } = useTranslation();
  const book = useAppSelector((state) => state.reader.book);
  const index = useAppSelector((state) => state.reader.index);
  const cfi = useAppSelector((state) => state.reader.cfi);
  const isNovel = useAppSelector((state) => state.reader.isNovel);
  const entries = useAppSelector((state) => state.reader.entries);
  const bookmarks = useAppSelector((state) => state.bookmark.bookmarks);
  const bookmarksBookId = useAppSelector((state) => state.bookmark.bookId);
  const bookmarkStatus = useAppSelector((state) => state.bookmark.status);
  const dispatch = useAppDispatch();

  // Acting on a list that belongs to another book, or has not loaded, would remove the
  // wrong book's bookmark or add a duplicate.
  const isReady = book !== null && bookmarksBookId === book.id && bookmarkStatus === "succeeded";

  // A novel position is identified by its CFI, a comic position by its page index.
  const currentBookmark = useMemo(
    () =>
      isReady
        ? bookmarks.find((bookmark) =>
            isNovel
              ? cfi !== null && bookmark.cfi === cfi
              : bookmark.cfi === null && bookmark.pageIndex === index,
          )
        : undefined,
    [isReady, bookmarks, isNovel, cfi, index],
  );

  const toggle = useCallback(() => {
    if (!isReady || !book) {
      return;
    }
    if (currentBookmark) {
      dispatch(removeBookmark(currentBookmark.id));
      return;
    }
    // Name the bookmark after the novel's section label when there is one, so the
    // list reads as a table of contents; otherwise fall back to the page number.
    const pageName = t("book-reader.bookmark.default-page-name", { page: index + 1 });
    const name = isNovel ? (entries[index] ?? pageName) : pageName;
    dispatch(
      addBookmark({
        bookId: book.id,
        name,
        pageIndex: index,
        cfi: isNovel ? (cfi ?? null) : null,
      }),
    );
  }, [dispatch, isReady, book, currentBookmark, isNovel, entries, index, cfi, t]);

  return { currentBookmark, isReady, toggle };
};
