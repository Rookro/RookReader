import { useEffect } from "react";
import type { ReadingState } from "../../../domain/book/schema";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import { readingProgressChanged } from "../../../store/actions";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchSeries } from "../../Bookshelf/seriesSlice";
import { fetchBookshelves, fetchBooksInSelectedBookshelf } from "../../Bookshelf/slice";
import { fetchTags } from "../../Bookshelf/tagSlice";
import { fetchRecentlyReadBooks } from "../slice";

/**
 * A custom hook to synchronize history and bookshelf data across the application.
 *
 * This hook performs the initial data load and listens for the backend's change events. Each
 * '*-changed' event names one list, and only that list is refetched; the finer
 * 'reading-progress-changed' (a page turn) patches the affected book in place instead.
 */
export const useHistorySync = () => {
  const dispatch = useAppDispatch();
  const selectedBookshelfId = useAppSelector((state) => state.bookCollection.selectedId);
  const recordReadingHistory = useAppSelector(
    (state) => state.settings.history.recordReadingHistory,
  );

  // Initial load of metadata
  useEffect(() => {
    dispatch(fetchBookshelves());
    dispatch(fetchTags());
    dispatch(fetchSeries());
    dispatch(fetchRecentlyReadBooks());
  }, [dispatch]);

  // Load books when selected bookshelf changes
  useEffect(() => {
    dispatch(fetchBooksInSelectedBookshelf(selectedBookshelfId));
  }, [dispatch, selectedBookshelfId]);

  useTauriEvent("bookshelves-changed", () => {
    dispatch(fetchBookshelves());
  });
  useTauriEvent("tags-changed", () => {
    dispatch(fetchTags());
  });
  useTauriEvent("series-changed", () => {
    dispatch(fetchSeries());
  });
  useTauriEvent("books-changed", () => {
    dispatch(fetchBooksInSelectedBookshelf(selectedBookshelfId));
  });
  useTauriEvent("reading-history-changed", () => {
    if (recordReadingHistory) {
      dispatch(fetchRecentlyReadBooks());
    }
  });

  // A page turn only changes reading progress; patch the affected book in place
  // instead of refetching a list.
  useTauriEvent<ReadingState>("reading-progress-changed", (event) => {
    dispatch(readingProgressChanged(event.payload));
  });
};
