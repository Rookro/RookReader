import { Middleware } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { debounce } from "@mui/material";
import { upsertReadingState } from "../../bindings/BookCommands";
import { ReadingState } from "../../types/DatabaseModels";
import { RootState } from "../store";

const debouncedReadingStateUpdate = debounce(async (state: ReadingState) => {
  try {
    await upsertReadingState(state);
  } catch (e) {
    error(`ReadingState update failed (${state.book_id}:${state.last_read_page_index}): ${e}`);
  }
}, 500);

export const readingStateMiddleware: Middleware<object, RootState> =
  (store) => (next) => (action: unknown) => {
    const result = next(action);

    if (typeof action !== "object" || action === null || !("type" in action)) {
      return result;
    }
    switch (action.type) {
      case "read/setImageIndex": {
        const state = store.getState();
        if (state.settings.history.recordReadingHistory) {
          const { history, historyIndex, index, book } = state.read.containerFile;

          if (history[historyIndex] && index > -1 && book && book.last_opened_at) {
            debouncedReadingStateUpdate({
              book_id: book.id,
              last_read_page_index: index,
              last_opened_at: book.last_opened_at,
            });
          }
        }
        break;
      }
      case "read/setNovelLocation": {
        const state = store.getState();
        if (state.settings.history.recordReadingHistory) {
          const { history, historyIndex, index, book } = state.read.containerFile;

          if (history[historyIndex] && index > -1 && book && book.last_opened_at) {
            // TODO(Rookro): Persist the current CFI to the database for EPUB novels.
            debouncedReadingStateUpdate({
              book_id: book.id,
              last_read_page_index: index,
              last_opened_at: book.last_opened_at,
            });
          }
        }
        break;
      }
    }

    return result;
  };
