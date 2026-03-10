import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../Store";
import { settingsStore } from "../settings/SettingsStore";
import { setEnableHistory } from "../reducers/ViewReducer";
import { clearAllHistory, fetchRecentlyReadBooks } from "../reducers/HistoryReducer";

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryEntriesUpdater = () => {
  const { enableHistory } = useAppSelector((state) => state.view);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const initHistory = async () => {
      const isHistoryEnabled = (await settingsStore.get<boolean>("enable-history")) ?? true;
      dispatch(setEnableHistory(isHistoryEnabled));

      if (!isHistoryEnabled) {
        return;
      }

      dispatch(fetchRecentlyReadBooks());
    };
    initHistory();
  }, [dispatch]);

  useEffect(() => {
    if (enableHistory) {
      return;
    }

    dispatch(clearAllHistory());
  }, [dispatch, enableHistory]);
};
