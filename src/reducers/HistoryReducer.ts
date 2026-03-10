import { createSlice } from "@reduxjs/toolkit";
import type { ReadBook } from "../types/DatabaseModels";
import { clearAllReadingHistory, getRecentlyReadBooks } from "../bindings/BookCommands";
import { clearReadingHistory } from "../bindings/BookCommands";
import { error } from "@tauri-apps/plugin-log";
import { CommandError, ErrorCode } from "../types/Error";
import { createAppAsyncThunk } from "../types/CustomAsyncThunk";

/**
 * Fetches the list of recently read books from the database.
 *
 * @returns A thunk that resolves to an array of ReadBook objects.
 */
export const fetchRecentlyReadBooks = createAppAsyncThunk(
  "history/fetchRecentlyReadBooks",
  async (_, { rejectWithValue }) => {
    try {
      return await getRecentlyReadBooks();
    } catch (e) {
      const errorMessage = `Failed to fetch recently read books. Error: ${JSON.stringify(e)}`;
      error(errorMessage);
      return rejectWithValue(
        e instanceof CommandError
          ? { code: e.code, message: errorMessage }
          : { code: ErrorCode.OTHER_ERROR, message: errorMessage },
      );
    }
  },
);

/**
 * Clears the reading history for a specific book.
 *
 * @param bookId - The ID of the book whose history should be cleared.
 * @returns A thunk that resolves to the updated list of recently read books.
 */
export const clearHistory = createAppAsyncThunk(
  "history/clearHistory",
  async (bookId: number, { rejectWithValue }) => {
    try {
      await clearReadingHistory(bookId);
      return await getRecentlyReadBooks();
    } catch (e) {
      const errorMessage = `Failed to clear history of ${bookId}. Error: ${JSON.stringify(e)}`;
      error(errorMessage);
      return rejectWithValue(
        e instanceof CommandError
          ? { code: e.code, message: errorMessage }
          : { code: ErrorCode.OTHER_ERROR, message: errorMessage },
      );
    }
  },
);

/**
 * Clears all reading history from the database.
 *
 * @returns A thunk that resolves when the history is successfully cleared.
 */
export const clearAllHistory = createAppAsyncThunk(
  "history/clearAllHistory",
  async (_, { rejectWithValue }) => {
    try {
      await clearAllReadingHistory();
    } catch (e) {
      const errorMessage = `Failed to clear all history. Error: ${JSON.stringify(e)}`;
      error(errorMessage);
      return rejectWithValue(
        e instanceof CommandError
          ? { code: e.code, message: errorMessage }
          : { code: ErrorCode.OTHER_ERROR, message: errorMessage },
      );
    }
  },
);

const historySlice = createSlice({
  name: "history",
  initialState: {
    recentlyReadBooks: [] as ReadBook[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as { code: ErrorCode; message?: string } | null,
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
      .addCase(clearHistory.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.recentlyReadBooks = action.payload;
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
      });
  },
});

export const { clearHistoryError } = historySlice.actions;
export default historySlice.reducer;
