import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createTag, deleteTag, getAllTags } from "../../bindings/TagCommands";
import type { Tag } from "../../domain/tag/schema";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { ErrorCode } from "../../types/Error";

/**
 * Creates a new tag and adds it to the database.
 *
 * @param params - The parameters for creating a tag.
 * @param params.name - The name of the new tag.
 * @param params.color_code - The hex color code associated with the tag.
 * @returns A thunk that resolves to the newly created Tag object.
 */
export const addTag = createAppAsyncThunk(
  "tag/addTag",
  async ({ name, color_code }: { name: string; color_code: string }, { rejectWithValue }) => {
    try {
      return await createTag(name, color_code);
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to add tag(name: ${name}, color_code: ${color_code}).`,
        rejectWithValue,
      );
    }
  },
);

/**
 * Fetches all available tags from the database.
 *
 * @returns A thunk that resolves to an array of all Tag objects.
 */
export const fetchTags = createAppAsyncThunk("tag/fetchTags", async (_, { rejectWithValue }) => {
  try {
    return await getAllTags();
  } catch (e) {
    return handleThunkError(e, "Failed to fetch all available tags.", rejectWithValue);
  }
});

/**
 * Deletes a tag and refetches all tags.
 *
 * @param id - The ID of the tag to delete.
 * @returns A thunk that resolves when the tag is deleted.
 */
export const removeTag = createAppAsyncThunk(
  "tag/removeTag",
  async (id: number, { rejectWithValue }) => {
    try {
      await deleteTag(id);
      return id;
    } catch (e) {
      return handleThunkError(e, `Failed to remove tag(id: ${id}).`, rejectWithValue);
    }
  },
);

const tagSlice = createSlice({
  name: "tag",
  initialState: {
    tags: [] as Tag[],
    selectedId: null as number | null,
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as { code: ErrorCode; message?: string } | null,
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
      });
  },
});

export const { setSelectedTag, clearTagError } = tagSlice.actions;
export default tagSlice.reducer;
