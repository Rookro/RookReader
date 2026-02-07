import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../Store";
import {
  clearHistory,
  setHistoryEntries,
  setIsHistoryEnabled,
  updateHistoryEntries,
} from "../reducers/HistoryReducer";
import { settingsStore } from "../settings/SettingsStore";

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryEntriesUpdater = () => {
  const { isHistoryEnabled } = useAppSelector((state) => state.history);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const initHistory = async () => {
      const isHistoryEnabled = (await settingsStore.get<boolean>("enable-history")) ?? true;
      dispatch(setIsHistoryEnabled(isHistoryEnabled));

      if (!isHistoryEnabled) {
        return;
      }

      dispatch(updateHistoryEntries());
    };
    initHistory();
  }, [dispatch]);

  useEffect(() => {
    if (isHistoryEnabled) {
      return;
    }

    dispatch(clearHistory());
    dispatch(setHistoryEntries([]));
  }, [dispatch, isHistoryEnabled]);
};
