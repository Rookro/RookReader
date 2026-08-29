import { createSlice } from "@reduxjs/toolkit";
import {
  createBookmark,
  deleteBookmark,
  getBookmarksByBookId,
  renameBookmark,
} from "../../bindings/BookmarkCommands";
import type { Bookmark } from "../../domain/bookmark/schema";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { ErrorCode } from "../../types/Error";

/**
 * Fetches all bookmarks of a book.
 *
 * @param bookId - The ID of the book whose bookmarks to fetch.
 * @returns A thunk that resolves to the book's bookmarks.
 */
export const fetchBookmarks = createAppAsyncThunk(
  "bookmark/fetchBookmarks",
  async (bookId: number, { rejectWithValue }) => {
    try {
      return await getBookmarksByBookId(bookId);
    } catch (e) {
      return handleThunkError(e, `Failed to fetch bookmarks(bookId: ${bookId}).`, rejectWithValue);
    }
  },
);

/**
 * Creates a bookmark at a position within a book.
 *
 * @param params - The bookmark to create.
 * @param params.bookId - The ID of the book to bookmark.
 * @param params.name - The display name of the new bookmark.
 * @param params.pageIndex - The comic page index, or the EPUB spine section index.
 * @param params.cfi - The position within an EPUB section, or null for comics.
 * @returns A thunk that resolves to the newly created Bookmark object.
 */
export const addBookmark = createAppAsyncThunk(
  "bookmark/addBookmark",
  async (
    params: { bookId: number; name: string; pageIndex: number; cfi: string | null },
    { rejectWithValue },
  ) => {
    try {
      return await createBookmark(params);
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to add bookmark(bookId: ${params.bookId}, pageIndex: ${params.pageIndex}).`,
        rejectWithValue,
      );
    }
  },
);

/**
 * Deletes a bookmark.
 *
 * @param id - The ID of the bookmark to remove.
 * @returns A thunk that resolves to the removed bookmark's ID.
 */
export const removeBookmark = createAppAsyncThunk(
  "bookmark/removeBookmark",
  async (id: number, { rejectWithValue }) => {
    try {
      await deleteBookmark(id);
      return id;
    } catch (e) {
      return handleThunkError(e, `Failed to remove bookmark(id: ${id}).`, rejectWithValue);
    }
  },
);

/**
 * Renames a bookmark.
 *
 * @param params - The rename request.
 * @param params.id - The ID of the bookmark to rename.
 * @param params.name - The new display name.
 * @returns A thunk that resolves to the renamed bookmark's ID and new name.
 */
export const updateBookmarkName = createAppAsyncThunk(
  "bookmark/renameBookmark",
  async (params: { id: number; name: string }, { rejectWithValue }) => {
    try {
      await renameBookmark(params.id, params.name);
      return params;
    } catch (e) {
      return handleThunkError(e, `Failed to rename bookmark(id: ${params.id}).`, rejectWithValue);
    }
  },
);

/** Orders bookmarks by their position in the book, mirroring the backend's ordering. */
const byPosition = (a: Bookmark, b: Bookmark) =>
  a.page_index - b.page_index || a.created_at.localeCompare(b.created_at) || a.id - b.id;

const bookmarkSlice = createSlice({
  name: "bookmark",
  initialState: {
    bookmarks: [] as Bookmark[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as { code: ErrorCode; message?: string } | null,
  },
  reducers: {
    /**
     * Clears any error associated with the bookmark state.
     *
     * @param state - The current Redux state slice.
     */
    clearBookmarkError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookmarks.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.bookmarks = action.payload;
        state.error = null;
      })
      .addCase(fetchBookmarks.rejected, (state, action) => {
        state.status = "failed";
        state.bookmarks = [];
        state.error = action.payload ?? null;
      })
      .addCase(addBookmark.fulfilled, (state, action) => {
        state.bookmarks = [...state.bookmarks, action.payload].sort(byPosition);
        state.error = null;
      })
      .addCase(addBookmark.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(removeBookmark.fulfilled, (state, action) => {
        state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== action.payload);
        state.error = null;
      })
      .addCase(removeBookmark.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(updateBookmarkName.fulfilled, (state, action) => {
        const target = state.bookmarks.find((bookmark) => bookmark.id === action.payload.id);
        if (target) {
          target.name = action.payload.name;
        }
        state.error = null;
      })
      .addCase(updateBookmarkName.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      });
  },
});

export const { clearBookmarkError } = bookmarkSlice.actions;
export default bookmarkSlice.reducer;
