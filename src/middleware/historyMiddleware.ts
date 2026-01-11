import { Middleware } from "@reduxjs/toolkit";
import { HistoryTable } from "../database/historyTable";
import { error } from "@tauri-apps/plugin-log";

let debounceTimerId: number | null = null;
let historyTable: HistoryTable | null = null;

export const historyMiddleware: Middleware = (store) => (next) => async (action: any) => {
  const result = next(action);

  if (action.type === "file/setImageIndex") {
    const state = store.getState();
    if (state.history.isHistoryEnabled) {
      const { history, historyIndex, index, isDirectory } = state.file.containerFile;

      if (history[historyIndex] && index > -1) {
        if (debounceTimerId) {
          clearTimeout(debounceTimerId);
        }
        debounceTimerId = setTimeout(async () => {
          if (!historyTable) {
            historyTable = new HistoryTable();
          }
          try {
            await historyTable.upsert(
              history[historyIndex],
              isDirectory ? "DIRECTORY" : "FILE",
              index,
            );
          } catch (e) {
            error(`History update failed (${history[historyIndex]}:${index}): ${e}`);
          }
          debounceTimerId = null;
        }, 500);
      }
    }
  }

  return result;
};
