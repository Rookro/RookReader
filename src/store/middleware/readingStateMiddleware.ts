import type { Middleware } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { updateReadingProgress } from "../../bindings/BookCommands";
import type { ReadingState } from "../../domain/book/schema";
import { setImageIndex, setNovelLocation } from "../../features/BookReader/slice";
import type { RootState } from "../store";

type PendingUpdate = { state: ReadingState; shouldRecord: () => boolean };

/** How long page turns are coalesced before the position is written. */
const DEBOUNCE_MS = 500;

/**
 * Builds the middleware that persists the reading position, debounced per store.
 *
 * A factory rather than module state, so every store — the app's, and each test's — owns
 * its own pending write and timer.
 *
 * @returns The middleware, and `flush`, which writes whatever is still pending.
 */
export const createReadingStateMiddleware = () => {
  let pending: PendingUpdate | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const update = pending;
    pending = null;
    // Re-check at fire time: the user may have disabled history during the window.
    if (!update?.shouldRecord()) {
      return Promise.resolve();
    }
    return updateReadingProgress(update.state).catch((e) => {
      error(
        `ReadingState update failed (${update.state.book_id}:${update.state.last_read_page_index}): ${e}`,
      );
    });
  };

  const queue = (update: PendingUpdate) => {
    // Flush immediately when the pending write belongs to a different book, so a
    // book switch never silently replaces the previous book's final position.
    if (pending && pending.state.book_id !== update.state.book_id) {
      void flush();
    }
    pending = update;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  };

  const middleware: Middleware<object, RootState> = (store) => (next) => (action: unknown) => {
    const result = next(action);

    if (typeof action !== "object" || action === null || !("type" in action)) {
      return result;
    }
    switch (action.type) {
      case setImageIndex.type:
      case setNovelLocation.type: {
        const state = store.getState();
        if (state.settings.history.recordReadingHistory) {
          const { history, historyIndex, index, cfi, book } = state.read.containerFile;

          if (history[historyIndex] && index > -1 && book?.last_opened_at) {
            queue({
              state: {
                book_id: book.id,
                last_read_page_index: index,
                // foliate-js occasionally emits an empty CFI; store null instead of "".
                cfi: cfi || null,
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

  return { middleware, flush };
};
