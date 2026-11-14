import { createSlice } from "@reduxjs/toolkit";
import { api } from "../../bindings/api";
import type { ReadBook } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { createCommandThunk } from "../../types/CustomAsyncThunk";

/**
 * Fetches the list of recently read books from the database.
 *
 * @returns A thunk that resolves to an array of ReadBook objects.
 */
export const fetchRecentlyReadBooks = createCommandThunk(
  "history/fetchRecentlyReadBooks",
  () => api.getRecentlyReadBooks(null),
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
    await api.clearReadingHistory(bookId);
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
    await api.clearAllReadingHistory();
  },
  () => "Failed to clear all history.",
);

const historySlice = createSlice({
  name: "history",
  initialState: {
    recentlyReadBooks: [] as ReadBook[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecentlyReadBooks.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchRecentlyReadBooks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.recentlyReadBooks = action.payload;
      })
      .addCase(fetchRecentlyReadBooks.rejected, (state) => {
        state.status = "failed";
        state.recentlyReadBooks = [];
      })
      .addCase(clearHistory.pending, (state) => {
        state.status = "loading";
      })
      .addCase(clearHistory.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(clearHistory.rejected, (state) => {
        state.status = "failed";
      })
      .addCase(clearAllHistory.pending, (state) => {
        state.status = "loading";
      })
      .addCase(clearAllHistory.fulfilled, (state) => {
        state.status = "succeeded";
        state.recentlyReadBooks = [];
      })
      .addCase(clearAllHistory.rejected, (state) => {
        state.status = "failed";
      })
      .addCase(readingProgressChanged, (state, action) => {
        // Patch a book already in the list; one not listed yet is added by the
        // history refetch, not here.
        const book = state.recentlyReadBooks.find((b) => b.id === action.payload.book_id);
        if (book) {
          book.last_read_page_index = action.payload.last_read_page_index;
          book.last_opened_at = action.payload.last_opened_at ?? book.last_opened_at;
        }
      });
  },
});

export default historySlice.reducer;
