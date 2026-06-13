import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { updateSeriesOrders } from "../../bindings/BookCommands";
import { getAllSeries } from "../../bindings/SeriesCommands";
import type { BookWithState } from "../../domain/book/schema";
import type { Series } from "../../domain/series/schema";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { ErrorCode } from "../../types/Error";

/**
 * Updates the order of books within a series and refetches the bookshelf to reflect the changes.
 *
 * @param bookIds - The array of book IDs in the desired new order.
 * @returns A thunk that resolves when the update is successful.
 */
export const updateSeriesOrdersThunk = createAppAsyncThunk(
  "series/updateSeriesOrdersThunk",
  async (bookIds: number[], { rejectWithValue }) => {
    try {
      await updateSeriesOrders(bookIds);
    } catch (e) {
      return handleThunkError(e, "Failed to update series orders.", rejectWithValue);
    }
  },
);

/**
 * Fetches all available series from the database.
 *
 * @returns A thunk that resolves to an array of all Series objects.
 */
export const fetchSeries = createAppAsyncThunk(
  "series/fetchSeries",
  async (_, { rejectWithValue }) => {
    try {
      return await getAllSeries();
    } catch (e) {
      return handleThunkError(e, "Failed to fetch all available series.", rejectWithValue);
    }
  },
);

const seriesSlice = createSlice({
  name: "series",
  initialState: {
    series: [] as Series[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    isEditSeriesOrderDialogOpen: false,
    editSeriesOrderTargetId: null as number | null,
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as { code: ErrorCode; message?: string } | null,
  },
  reducers: {
    /**
     * Sets the ID of the currently selected series.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the selected series ID, or null to clear.
     */
    setSelectedSeriesId(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
    },
    /**
     * Opens or closes the Edit Series Order dialog for a specific series.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing isOpen flag and the series ID (if opening).
     */
    setEditSeriesOrderDialogState(
      state,
      action: PayloadAction<{ isOpen: boolean; seriesId: number | null }>,
    ) {
      state.isEditSeriesOrderDialogOpen = action.payload.isOpen;
      state.editSeriesOrderTargetId = action.payload.seriesId;
    },
    /**
     * Clears any error associated with the series state.
     *
     * @param state - The current Redux state slice.
     */
    clearSeriesError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSeries.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchSeries.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.series = action.payload;
        state.error = null;
      })
      .addCase(fetchSeries.rejected, (state, action) => {
        state.status = "failed";
        state.series = [];
        state.error = action.payload ?? null;
      });
  },
});

export const { setSelectedSeriesId, setEditSeriesOrderDialogState, clearSeriesError } =
  seriesSlice.actions;
export default seriesSlice.reducer;
