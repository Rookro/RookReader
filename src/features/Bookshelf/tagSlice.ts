import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createTag, deleteTag, getAllTags, setTagsForBook } from "../../bindings/TagCommands";
import type { Tag } from "../../domain/entities";
import { recordThunkError } from "../../store/thunkErrorHandler";
import { createCommandThunk, type ThunkRejectValue } from "../../types/CustomAsyncThunk";

/**
 * Creates a new tag and adds it to the database.
 *
 * @param params - The parameters for creating a tag.
 * @param params.name - The name of the new tag.
 * @param params.color_code - The hex color code associated with the tag.
 * @returns A thunk that resolves to the newly created Tag object.
 */
export const addTag = createCommandThunk(
  "tag/addTag",
  ({ name, color_code }: { name: string; color_code: string }) => createTag(name, color_code),
  ({ name, color_code }) => `Failed to add tag(name: ${name}, color_code: ${color_code}).`,
);

/**
 * Fetches all available tags from the database.
 *
 * @returns A thunk that resolves to an array of all Tag objects.
 */
export const fetchTags = createCommandThunk(
  "tag/fetchTags",
  () => getAllTags(),
  () => "Failed to fetch all available tags.",
);

/**
 * Deletes a tag and refetches all tags.
 *
 * @param id - The ID of the tag to delete.
 * @returns A thunk that resolves when the tag is deleted.
 */
export const removeTag = createCommandThunk(
  "tag/removeTag",
  async (id: number) => {
    await deleteTag(id);
    return id;
  },
  (id) => `Failed to remove tag(id: ${id}).`,
);

/**
 * Saves a new tag set for each given book.
 *
 * @param updates - Each book with its complete new tag set.
 * @returns A thunk that resolves when every book is updated.
 */
export const updateBooksTags = createCommandThunk(
  "tag/updateBooksTags",
  async (updates: { bookId: number; tagIds: number[] }[]) => {
    await Promise.all(updates.map(({ bookId, tagIds }) => setTagsForBook(bookId, tagIds)));
  },
  () => "Failed to update book tags.",
);

const tagSlice = createSlice({
  name: "tag",
  initialState: {
    tags: [] as Tag[],
    selectedId: null as number | null,
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as ThunkRejectValue | null,
  },
  reducers: {
    /**
     * Sets the currently selected tag ID in the state.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the selected tag ID, or null to clear.
     */
    setSelectedTag(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
    },
    /**
     * Clears any error associated with the tag state.
     *
     * @param state - The current Redux state slice.
     */
    clearTagError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addTag.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(addTag.fulfilled, (state) => {
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(addTag.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(fetchTags.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.tags = action.payload;
        state.error = null;
      })
      .addCase(fetchTags.rejected, (state, action) => {
        state.status = "failed";
        state.tags = [];
        state.error = action.payload ?? null;
      })
      .addCase(removeTag.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(removeTag.fulfilled, (state, action) => {
        if (state.selectedId === action.payload) {
          state.selectedId = null;
        }
      })
      .addCase(removeTag.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      // Only the error: a mutation must not flip `status` to "loading", which would
      // blank the grid behind the open dialog.
      .addCase(updateBooksTags.rejected, recordThunkError);
  },
});

export const { setSelectedTag, clearTagError } = tagSlice.actions;
export default tagSlice.reducer;
