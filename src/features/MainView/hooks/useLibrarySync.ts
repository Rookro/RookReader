import { useEffect, useRef } from "react";
import { events } from "../../../bindings/bindings";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import { readingProgressChanged } from "../../../store/actions";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchSeries } from "../../Bookshelf/seriesSlice";
import { fetchBooksInSelectedCollection, fetchCollections } from "../../Bookshelf/slice";
import { fetchTags } from "../../Bookshelf/tagSlice";
import { fetchRecentlyReadBooks } from "../../History/slice";

/**
 * Loads the library (collections, tags, series, the selected collection's books and the reading
 * history) and keeps it in step with the backend's change events.
 *
 * This hook performs the initial data load and listens for the backend's change events. Each
 * '*-changed' event names one list, and only that list is refetched; the finer
 * 'reading-progress-changed' (a page turn) patches the affected book in place instead.
 */
export const useLibrarySync = () => {
  const dispatch = useAppDispatch();
  const selectedCollectionId = useAppSelector((state) => state.collection.selectedId);
  const recordReadingHistory = useAppSelector(
    (state) => state.settings.history.recordReadingHistory,
  );

  // Initial load of metadata
  useEffect(() => {
    dispatch(fetchCollections());
    dispatch(fetchTags());
    dispatch(fetchSeries());
    dispatch(fetchRecentlyReadBooks());
  }, [dispatch]);

  // History events are ignored while recording is off, so catch up when it comes back on.
  const wasRecordingRef = useRef(recordReadingHistory);
  useEffect(() => {
    if (recordReadingHistory && !wasRecordingRef.current) {
      dispatch(fetchRecentlyReadBooks());
    }
    wasRecordingRef.current = recordReadingHistory;
  }, [dispatch, recordReadingHistory]);

  // Load books when selected collection changes
  useEffect(() => {
    dispatch(fetchBooksInSelectedCollection(selectedCollectionId));
  }, [dispatch, selectedCollectionId]);

  useTauriEvent(events.collectionsChanged, () => {
    dispatch(fetchCollections());
  });
  useTauriEvent(events.tagsChanged, () => {
    dispatch(fetchTags());
  });
  useTauriEvent(events.seriesChanged, () => {
    dispatch(fetchSeries());
  });
  useTauriEvent(events.booksChanged, () => {
    dispatch(fetchBooksInSelectedCollection(selectedCollectionId));
  });
  useTauriEvent(events.readingHistoryChanged, () => {
    if (recordReadingHistory) {
      dispatch(fetchRecentlyReadBooks());
    }
  });

  // A page turn only changes reading progress; patch the affected book in place
  // instead of refetching a list.
  useTauriEvent(events.readingProgressChanged, (event) => {
    dispatch(readingProgressChanged(event.payload));
  });
};
