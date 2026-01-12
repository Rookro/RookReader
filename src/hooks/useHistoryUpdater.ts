import { useEffect, useRef } from "react";
import { debug, warn } from "@tauri-apps/plugin-log";
import { useAppDispatch, useAppSelector } from "../Store";
import { HistoryTable } from "../database/historyTable";
import {
  clearHistory,
  setHistoryEntries,
  setIsHistoryEnabled,
  updateHistoryEntries,
  upsertHistory,
} from "../reducers/HistoryReducer";
import { settingsStore } from "../settings/SettingsStore";
import { setImageIndex } from "../reducers/FileReducer";

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryUpdater = () => {
  const { history, historyIndex, isDirectory, isLoading, error } = useAppSelector(
    (state) => state.file.containerFile,
  );
  const { isHistoryEnabled } = useAppSelector((state) => state.history);
  const historyTableRef = useRef(new HistoryTable());
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
  }, [dispatch, isHistoryEnabled]);

  useEffect(() => {
    if (!isHistoryEnabled) {
      dispatch(setHistoryEntries([]));
      return;
    }

    if (isLoading || error) {
      return;
    }

    const updateHistory = async () => {
      if (history.length > 0 && historyIndex >= 0) {
        const currentPath = history[historyIndex];
        if (currentPath) {
          debug(`Update container history: ${currentPath}, ${isDirectory ? "DIRECTORY" : "FILE"}`);
          dispatch(upsertHistory({ path: currentPath, type: isDirectory ? "DIRECTORY" : "FILE" }));
          try {
            const lastPageIndex = await historyTableRef.current.selectPageIndex(currentPath);
            dispatch(setImageIndex(lastPageIndex));
          } catch (e) {
            warn(`Error selecting page index: ${e}`);
          }
        }
      }
    };
    updateHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isLoading, error]); // Only run when isLoading changes to false and error is not set.
};
