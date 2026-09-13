import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { updateBookSeries, updateSeriesOrders } from "../../bindings/BookCommands";
import { createSeries, deleteSeries, getAllSeries } from "../../bindings/SeriesCommands";
import type { BookWithState } from "../../domain/book/schema";
import type { Series } from "../../domain/series/schema";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { ErrorCode } from "../../types/Error";
import { fetchBooksInSelectedBookshelf } from "./slice";

/**
 * Updates the order of books within a series and refetches the bookshelf to reflect the changes.
 *
 * @param bookIds - The array of book IDs in the desired new order.
 * @returns A thunk that resolves when the update is successful.
 */
export const updateSeriesOrdersThunk = createAppAsyncThunk(
  "series/updateSeriesOrdersThunk",
  async (bookIds: number[], { rejectWithValue, dispatch, getState }) => {
    try {
      await updateSeriesOrders(bookIds);
      // Honor the documented contract: refetch so the new order is reflected.
      const selectedBookshelfId = getState().bookCollection.selectedId;
      await dispatch(fetchBooksInSelectedBookshelf(selectedBookshelfId));
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

/**
 * Creates a series and refetches the list so the caller can select the new id at once
 * (the same in-thunk refetch `updateSeriesOrdersThunk` does).
 *
 * @param name - The name of the new series.
 * @returns A thunk that resolves to the new series id.
 */
export const addSeries = createAppAsyncThunk(
  "series/addSeries",
  async (name: string, { rejectWithValue, dispatch }) => {
    try {
      const id = await createSeries(name);
      await dispatch(fetchSeries());
      return id;
    } catch (e) {
      return handleThunkError(e, `Failed to add series(name: ${name}).`, rejectWithValue);
    }
  },
);

/**
 * Ungroups a series; the backend's `history-changed` refetch removes it from the grid.
 *
 * @param id - The ID of the series to remove.
 * @returns A thunk that resolves when the series is removed.
 */
export const removeSeries = createAppAsyncThunk(
  "series/removeSeries",
  async (id: number, { rejectWithValue }) => {
    try {
      await deleteSeries(id);
    } catch (e) {
      return handleThunkError(e, `Failed to remove series(id: ${id}).`, rejectWithValue);
    }
  },
);

/**
 * Assigns (or clears, with `null`) the series of every given book.
 *
 * @param params - The parameters for the update.
 * @param params.bookIds - The books to update.
 * @param params.seriesId - The series to assign, or null to detach the books from any series.
 * @returns A thunk that resolves when every book is updated.
 */
export const updateBooksSeries = createAppAsyncThunk(
  "series/updateBooksSeries",
  async (
    { bookIds, seriesId }: { bookIds: number[]; seriesId: number | null },
    { rejectWithValue },
  ) => {
    try {
      await Promise.all(bookIds.map((id) => updateBookSeries(id, seriesId)));
    } catch (e) {
      return handleThunkError(e, "Failed to update book series.", rejectWithValue);
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
      })
      // Only the error: a mutation must not flip `status` to "loading", which would
      // blank the grid behind the open dialog.
      .addCase(addSeries.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(removeSeries.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(updateBooksSeries.rejected, (state, action) => {
        state.error = action.payload ?? null;
      });
  },
});

export const { setSelectedSeriesId, setEditSeriesOrderDialogState, clearSeriesError } =
  seriesSlice.actions;
export default seriesSlice.reducer;
