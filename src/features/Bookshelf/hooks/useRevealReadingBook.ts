import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { setSelectedSeriesId } from "../seriesSlice";
import { setSearchText } from "../slice";
import { buildGridItems } from "../utils/BookshelfUtils";

/**
 * Moves the bookshelf to the level that holds the book being read, once per visit: opens the
 * book's series, or returns to the top level when the book is not in a series.
 *
 * Only a book the top level shows under the current collection, tag and search is revealed,
 * so going back with the breadcrumb sticks until the user leaves the bookshelf.
 */
export function useRevealReadingBook(): void {
  const dispatch = useAppDispatch();
  const activeView = useAppSelector((state) => state.view.activeView);
  const readingBook = useAppSelector((state) => state.read.containerFile.book);
  const books = useAppSelector((state) => state.bookCollection.books);
  const booksStatus = useAppSelector((state) => state.bookCollection.status);
  const searchText = useAppSelector((state) => state.bookCollection.searchText);
  const allSeries = useAppSelector((state) => state.series.series);
  const seriesStatus = useAppSelector((state) => state.series.status);
  const selectedSeriesId = useAppSelector((state) => state.series.selectedId);
  const tagId = useAppSelector((state) => state.tag.selectedId);
  const sortOrder = useAppSelector((state) => state.settings.bookshelf.sortOrder);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    if (activeView !== "bookshelf") {
      hasRevealedRef.current = false;
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "bookshelf" || hasRevealedRef.current) {
      return;
    }
    // Deciding on a list that is still loading would miss the book or its series.
    const isLoading = (status: string) => status === "idle" || status === "loading";
    if (isLoading(booksStatus) || isLoading(seriesStatus)) {
      return;
    }
    hasRevealedRef.current = true;
    if (!readingBook) {
      return;
    }

    const topLevelItem = buildGridItems({
      books,
      allSeries,
      tagId,
      selectedSeriesId: null,
      searchText,
      sortOrder,
    }).find((item) =>
      item.type === "series"
        ? item.books.some((book) => book.id === readingBook.id)
        : item.data.id === readingBook.id,
    );
    if (!topLevelItem) {
      return;
    }

    const targetSeriesId = topLevelItem.type === "series" ? topLevelItem.data.id : null;
    if (targetSeriesId === selectedSeriesId) {
      return;
    }
    dispatch(setSelectedSeriesId(targetSeriesId));
    if (targetSeriesId !== null) {
      // As when the cover is clicked: a search that matched the series name would hide its volumes.
      dispatch(setSearchText(""));
    }
  }, [
    dispatch,
    activeView,
    readingBook,
    books,
    booksStatus,
    searchText,
    allSeries,
    seriesStatus,
    selectedSeriesId,
    tagId,
    sortOrder,
  ]);
}
