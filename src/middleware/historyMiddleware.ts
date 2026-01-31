import { Middleware } from "@reduxjs/toolkit";
import { HistoryTable } from "../database/historyTable";
import { error } from "@tauri-apps/plugin-log";
import { debounce } from "@mui/material";

let historyTable: HistoryTable | null = null;
const debouncedHistoryUpdate = debounce(
  async (filePath: string, type: "DIRECTORY" | "FILE", index: number) => {
    if (!historyTable) {
      historyTable = new HistoryTable();
    }
    try {
      await historyTable.upsert(filePath, type, index);
    } catch (e) {
      error(`History update failed (${filePath}:${index}): ${e}`);
    }
  },
  500,
);

export const historyMiddleware: Middleware = (store) => (next) => async (action: unknown) => {
  const result = next(action);

  if (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "file/setImageIndex"
  ) {
    const state = store.getState();
    if (state.history.isHistoryEnabled) {
      const { history, historyIndex, index, isDirectory } = state.file.containerFile;

      if (history[historyIndex] && index > -1) {
        debouncedHistoryUpdate(history[historyIndex], isDirectory ? "DIRECTORY" : "FILE", index);
      }
    }
  }

  return result;
};
