import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../Store";
import { clearAllHistory, fetchRecentlyReadBooks } from "../reducers/HistoryReducer";

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryEntriesUpdater = () => {
  const { enableHistory } = useAppSelector((state) => state.view);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!enableHistory) {
      return;
    }
    dispatch(fetchRecentlyReadBooks());
  }, [dispatch, enableHistory]);

  useEffect(() => {
    if (enableHistory) {
      return;
    }

    dispatch(clearAllHistory());
  }, [dispatch, enableHistory]);
};
