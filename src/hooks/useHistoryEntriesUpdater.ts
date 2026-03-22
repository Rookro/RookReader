import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../Store";
import { clearAllHistory, fetchRecentlyReadBooks } from "../reducers/HistoryReducer";

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryEntriesUpdater = () => {
  const enableHistory = useAppSelector((state) => state.settings.history.enable);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (enableHistory) {
      dispatch(fetchRecentlyReadBooks());
    } else {
      dispatch(clearAllHistory());
    }
  }, [dispatch, enableHistory]);
};
