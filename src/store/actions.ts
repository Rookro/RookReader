import { createAction } from "@reduxjs/toolkit";
import type { ReadingState } from "../domain/entities";

/**
 * Dispatched when the backend reports a reading-progress update for a book
 * (the `reading-progress-changed` Tauri event). Both the history and
 * book-collection slices patch the matching book in place instead of re-fetching.
 */
export const readingProgressChanged = createAction<ReadingState>("app/readingProgressChanged");
