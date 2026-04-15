import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { clearAllHistory, fetchRecentlyReadBooks } from "../slice";

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryEntriesUpdater = () => {
  const enableHistory = useAppSelector((state) => state.settings.history.recordReadingHistory);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (enableHistory) {
      dispatch(fetchRecentlyReadBooks());
    } else {
      dispatch(clearAllHistory());
    }
  }, [dispatch, enableHistory]);
};
