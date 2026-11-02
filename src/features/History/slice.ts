import { createSlice } from "@reduxjs/toolkit";
import {
  clearAllReadingHistory,
  clearReadingHistory,
  getRecentlyReadBooks,
} from "../../bindings/BookCommands";
import type { ReadBook } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { createCommandThunk, type ThunkRejectValue } from "../../types/CustomAsyncThunk";

/**
 * Fetches the list of recently read books from the database.
 *
 * @returns A thunk that resolves to an array of ReadBook objects.
 */
export const fetchRecentlyReadBooks = createCommandThunk(
  "history/fetchRecentlyReadBooks",
  () => getRecentlyReadBooks(),
  () => "Failed to fetch recently read books.",
);

/**
 * Clears the reading history for a specific book.
 *
 * @param bookId - The ID of the book whose history should be cleared.
 * @returns A thunk that resolves to the updated list of recently read books.
 */
export const clearHistory = createCommandThunk(
  "history/clearHistory",
  async (bookId: number) => {
    await clearReadingHistory(bookId);
  },
  (bookId) => `Failed to clear history of ${bookId}.`,
);

/**
 * Clears all reading history from the database.
 *
 * @returns A thunk that resolves when the history is successfully cleared.
 */
export const clearAllHistory = createCommandThunk(
  "history/clearAllHistory",
  async () => {
    await clearAllReadingHistory();
  },
  () => "Failed to clear all history.",
);

const historySlice = createSlice({
  name: "history",
  initialState: {
    recentlyReadBooks: [] as ReadBook[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as ThunkRejectValue | null,
  },
  reducers: {
    /**
     * Clears any error associated with the history state.
     *
     * @param state - The current Redux state slice.
     */
    clearHistoryError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecentlyReadBooks.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchRecentlyReadBooks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.recentlyReadBooks = action.payload;
        state.error = null;
      })
      .addCase(fetchRecentlyReadBooks.rejected, (state, action) => {
        state.status = "failed";
        state.recentlyReadBooks = [];
        state.error = action.payload ?? null;
      })
      .addCase(clearHistory.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(clearHistory.fulfilled, (state) => {
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(clearHistory.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(clearAllHistory.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(clearAllHistory.fulfilled, (state) => {
        state.status = "succeeded";
        state.recentlyReadBooks = [];
        state.error = null;
      })
      .addCase(clearAllHistory.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(readingProgressChanged, (state, action) => {
        // A page turn cannot change list membership or order (last_opened_at is only
        // set when a book is opened), so patch the matching entry in place.
        const book = state.recentlyReadBooks.find((b) => b.id === action.payload.book_id);
        if (book) {
          book.last_read_page_index = action.payload.last_read_page_index;
          book.last_opened_at = action.payload.last_opened_at ?? book.last_opened_at;
        }
      });
  },
});

export const { clearHistoryError } = historySlice.actions;
export default historySlice.reducer;
