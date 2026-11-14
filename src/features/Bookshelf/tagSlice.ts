import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api } from "../../bindings/api";
import type { Tag } from "../../domain/entities";
import { createCommandThunk } from "../../types/CustomAsyncThunk";

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
  ({ name, color_code }: { name: string; color_code: string }) => api.createTag(name, color_code),
  ({ name, color_code }) => `Failed to add tag(name: ${name}, color_code: ${color_code}).`,
);

/**
 * Fetches all available tags from the database.
 *
 * @returns A thunk that resolves to an array of all Tag objects.
 */
export const fetchTags = createCommandThunk(
  "tag/fetchTags",
  () => api.getAllTags(),
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
    await api.deleteTag(id);
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
    await Promise.all(updates.map(({ bookId, tagIds }) => api.setTagsForBook(bookId, tagIds)));
  },
  () => "Failed to update book tags.",
);

const tagSlice = createSlice({
  name: "tag",
  initialState: {
    tags: [] as Tag[],
    selectedId: null as number | null,
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(addTag.pending, (state) => {
        state.status = "loading";
      })
      .addCase(addTag.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(addTag.rejected, (state) => {
        state.status = "failed";
      })
      .addCase(fetchTags.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.tags = action.payload;
      })
      .addCase(fetchTags.rejected, (state) => {
        state.status = "failed";
        state.tags = [];
      })
      .addCase(removeTag.pending, (state) => {
        state.status = "loading";
      })
      .addCase(removeTag.fulfilled, (state, action) => {
        if (state.selectedId === action.payload) {
          state.selectedId = null;
        }
      })
      .addCase(removeTag.rejected, (state) => {
        state.status = "failed";
      });
  },
});

export const { setSelectedTag } = tagSlice.actions;
export default tagSlice.reducer;
