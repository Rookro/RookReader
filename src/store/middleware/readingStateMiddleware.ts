import { debounce } from "@mui/material";
import type { Middleware } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { updateReadingProgress } from "../../bindings/BookCommands";
import type { ReadingState } from "../../domain/book/schema";
import { setImageIndex, setNovelLocation } from "../../features/BookReader/slice";
import type { RootState } from "../store";

const debouncedReadingStateUpdate = debounce(
  async (state: ReadingState, shouldRecord: () => boolean) => {
    // Re-check at fire time: the user may have disabled history during the
    // debounce window, and we must not persist progress after that.
    if (!shouldRecord()) {
      return;
    }
    try {
      await updateReadingProgress(state);
    } catch (e) {
      error(`ReadingState update failed (${state.book_id}:${state.last_read_page_index}): ${e}`);
    }
  },
  500,
);

export const readingStateMiddleware: Middleware<object, RootState> =
  (store) => (next) => (action: unknown) => {
    const result = next(action);

    if (typeof action !== "object" || action === null || !("type" in action)) {
      return result;
    }
    switch (action.type) {
      case setImageIndex.type:
      case setNovelLocation.type: {
        const state = store.getState();
        if (state.settings.history.recordReadingHistory) {
          const { history, historyIndex, index, book } = state.read.containerFile;

          if (history[historyIndex] && index > -1 && book?.last_opened_at) {
            // TODO(Rookro): Persist the current CFI to the database for EPUB novels.
            debouncedReadingStateUpdate(
              {
                book_id: book.id,
                last_read_page_index: index,
                last_opened_at: book.last_opened_at,
              },
              () => store.getState().settings.history.recordReadingHistory,
            );
          }
        }
        break;
      }
    }

    return result;
  };
