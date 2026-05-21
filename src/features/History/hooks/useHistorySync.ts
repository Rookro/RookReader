import { useEffect } from "react";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import {
  fetchBookshelves,
  fetchBooksInSelectedBookshelf,
  fetchSeries,
  fetchTags,
} from "../../Bookshelf/slice";
import { fetchRecentlyReadBooks } from "../slice";

/**
 * A custom hook to synchronize history and bookshelf data across the application.
 *
 * This hook performs the initial data load and listens for 'history-changed' events
 * from the backend to trigger real-time updates of the reading history and bookshelf contents.
 */
export const useHistorySync = () => {
  const dispatch = useAppDispatch();
  const selectedBookshelfId = useAppSelector((state) => state.bookCollection.bookshelf.selectedId);
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
};
