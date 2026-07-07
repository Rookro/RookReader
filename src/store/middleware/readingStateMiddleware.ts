import type { Middleware } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { updateReadingProgress } from "../../bindings/BookCommands";
import type { ReadingState } from "../../domain/book/schema";
import { setImageIndex, setNovelLocation } from "../../features/BookReader/slice";
import type { RootState } from "../store";

type PendingUpdate = { state: ReadingState; shouldRecord: () => boolean };

let pending: PendingUpdate | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const update = pending;
  pending = null;
  // Re-check at fire time: the user may have disabled history during the window.
  if (!update?.shouldRecord()) {
    return;
  }
  updateReadingProgress(update.state).catch((e) => {
    error(
      `ReadingState update failed (${update.state.book_id}:${update.state.last_read_page_index}): ${e}`,
    );
  });
};

const queueReadingStateUpdate = (update: PendingUpdate) => {
  // Flush immediately when the pending write belongs to a different book, so a
  // book switch never silently replaces the previous book's final position.
  if (pending && pending.state.book_id !== update.state.book_id) {
    flush();
  }
  pending = update;
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(flush, 500);
};

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
            queueReadingStateUpdate({
              state: {
                book_id: book.id,
                last_read_page_index: index,
                last_opened_at: book.last_opened_at,
              },
              shouldRecord: () => store.getState().settings.history.recordReadingHistory,
            });
          }
        }
        break;
      }
    }

    return result;
  };
