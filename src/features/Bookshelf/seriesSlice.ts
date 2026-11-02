import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  createSeries,
  deleteSeries,
  getAllSeries,
  setSeriesForBook,
  setSeriesOrder,
} from "../../bindings/SeriesCommands";
import type { BookWithState, Series } from "../../domain/entities";
import { recordThunkError } from "../../store/thunkErrorHandler";
import { createCommandThunk, type ThunkRejectValue } from "../../types/CustomAsyncThunk";
import { setSelectedCollection } from "./slice";

/**
 * Updates the order of books within a series.
 *
 * The backend's `books-changed` event refreshes the bookshelf, so this does not refetch.
 *
 * @param bookIds - The array of book IDs in the desired new order.
 * @returns A thunk that resolves when the update is successful.
 */
export const updateSeriesOrdersThunk = createCommandThunk(
  "series/updateSeriesOrdersThunk",
  async (bookIds: number[]) => {
    await setSeriesOrder(bookIds);
  },
  () => "Failed to update series orders.",
);

/**
 * Fetches all available series from the database.
 *
 * @returns A thunk that resolves to an array of all Series objects.
 */
export const fetchSeries = createCommandThunk(
  "series/fetchSeries",
  () => getAllSeries(),
  () => "Failed to fetch all available series.",
);

/**
 * Creates a series and refetches the list so the caller can select the new id at once.
 *
 * @param name - The name of the new series.
 * @returns A thunk that resolves to the new series id.
 */
export const addSeries = createCommandThunk(
  "series/addSeries",
  async (name: string, { dispatch }) => {
    const series = await createSeries(name);
    await dispatch(fetchSeries());
    return series.id;
  },
  (name) => `Failed to add series(name: ${name}).`,
);

/**
 * Ungroups a series; the backend's `series-changed` and `books-changed` refetches remove it
 * from the grid.
 *
 * @param id - The ID of the series to remove.
 * @returns A thunk that resolves when the series is removed.
 */
export const removeSeries = createCommandThunk(
  "series/removeSeries",
  async (id: number) => {
    await deleteSeries(id);
  },
  (id) => `Failed to remove series(id: ${id}).`,
);

/**
 * Assigns (or clears, with `null`) the series of every given book.
 *
 * @param params - The parameters for the update.
 * @param params.bookIds - The books to update.
 * @param params.seriesId - The series to assign, or null to detach the books from any series.
 * @returns A thunk that resolves when every book is updated.
 */
export const updateBooksSeries = createCommandThunk(
  "series/updateBooksSeries",
  async ({ bookIds, seriesId }: { bookIds: number[]; seriesId: number | null }) => {
    await Promise.all(bookIds.map((id) => setSeriesForBook(id, seriesId)));
  },
  () => "Failed to update book series.",
);

const seriesSlice = createSlice({
  name: "series",
  initialState: {
    series: [] as Series[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as ThunkRejectValue | null,
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
      // A series is a level inside the chosen collection, so a new collection starts at its top.
      .addCase(setSelectedCollection, (state) => {
        state.selectedId = null;
      })
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
      .addCase(addSeries.rejected, recordThunkError)
      .addCase(removeSeries.rejected, recordThunkError)
      .addCase(updateBooksSeries.rejected, recordThunkError);
  },
});

export const { setSelectedSeriesId, clearSeriesError } = seriesSlice.actions;
export default seriesSlice.reducer;
