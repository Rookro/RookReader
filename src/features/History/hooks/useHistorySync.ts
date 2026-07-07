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
 * This hook performs the initial data load and listens for backend events: 'history-changed'
 * triggers a full refresh of the reading history and bookshelf contents, while the finer
 * 'reading-progress-changed' (a page turn) patches only the affected book in place.
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

  // Listen for history changes and refresh relevant data
  useTauriEvent("history-changed", () => {
    if (recordReadingHistory) {
      dispatch(fetchRecentlyReadBooks());
    }
    dispatch(fetchBookshelves());
    dispatch(fetchTags());
    dispatch(fetchSeries());
    dispatch(fetchBooksInSelectedBookshelf(selectedBookshelfId));
  });

  // A page turn only changes reading progress; patch the affected book in place
  // instead of refetching the whole library (unlike the coarse 'history-changed').
  useTauriEvent<ReadingState>("reading-progress-changed", (event) => {
    dispatch(readingProgressChanged(event.payload));
  });
};
