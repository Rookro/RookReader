import { createSlice } from "@reduxjs/toolkit";
import {
  createBookmark,
  deleteBookmark,
  getBookmarksByBookId,
  renameBookmark,
} from "../../bindings/BookmarkCommands";
import type { Bookmark } from "../../domain/entities";
import { recordThunkError } from "../../store/thunkErrorHandler";
import { createCommandThunk, type ThunkRejectValue } from "../../types/CustomAsyncThunk";

/**
 * Fetches all bookmarks of a book.
 *
 * @param bookId - The ID of the book whose bookmarks to fetch.
 * @returns A thunk that resolves to the book's bookmarks.
 */
export const fetchBookmarks = createCommandThunk(
  "bookmark/fetchBookmarks",
  (bookId: number) => getBookmarksByBookId(bookId),
  (bookId) => `Failed to fetch bookmarks(bookId: ${bookId}).`,
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
export const addBookmark = createCommandThunk(
  "bookmark/addBookmark",
  (params: { bookId: number; name: string; pageIndex: number; cfi: string | null }) =>
    createBookmark(params),
  (params) => `Failed to add bookmark(bookId: ${params.bookId}, pageIndex: ${params.pageIndex}).`,
);

/**
 * Deletes a bookmark.
 *
 * @param id - The ID of the bookmark to remove.
 * @returns A thunk that resolves to the removed bookmark's ID.
 */
export const removeBookmark = createCommandThunk(
  "bookmark/removeBookmark",
  async (id: number) => {
    await deleteBookmark(id);
    return id;
  },
  (id) => `Failed to remove bookmark(id: ${id}).`,
);

/**
 * Renames a bookmark.
 *
 * @param params - The rename request.
 * @param params.id - The ID of the bookmark to rename.
 * @param params.name - The new display name.
 * @returns A thunk that resolves to the renamed bookmark's ID and new name.
 */
export const updateBookmarkName = createCommandThunk(
  "bookmark/renameBookmark",
  async (params: { id: number; name: string }) => {
    await renameBookmark(params.id, params.name);
    return params;
  },
  (params) => `Failed to rename bookmark(id: ${params.id}).`,
);

/** Orders bookmarks by their position in the book, mirroring the backend's ordering. */
const byPosition = (a: Bookmark, b: Bookmark) =>
  a.page_index - b.page_index || a.created_at.localeCompare(b.created_at) || a.id - b.id;

const bookmarkSlice = createSlice({
  name: "bookmark",
  initialState: {
    /** The book `bookmarks` belongs to, or null when no list is loaded. */
    bookId: null as number | null,
    bookmarks: [] as Bookmark[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as ThunkRejectValue | null,
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
    /**
     * Forgets the loaded list, for when no book is open.
     *
     * @param state - The current Redux state slice.
     */
    clearBookmarks: (state) => {
      state.bookId = null;
      state.bookmarks = [];
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookmarks.pending, (state, action) => {
        if (action.meta.arg !== state.bookId) {
          state.bookId = action.meta.arg;
          state.bookmarks = [];
        }
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        // A late answer for a book that is no longer open.
        if (action.meta.arg !== state.bookId) {
          return;
        }
        state.status = "succeeded";
        state.bookmarks = action.payload;
        state.error = null;
      })
      .addCase(fetchBookmarks.rejected, (state, action) => {
        if (action.meta.arg !== state.bookId) {
          return;
        }
        state.status = "failed";
        state.bookmarks = [];
        state.error = action.payload ?? null;
      })
      .addCase(addBookmark.fulfilled, (state, action) => {
        if (action.payload.book_id !== state.bookId) {
          return;
        }
        state.bookmarks = [...state.bookmarks, action.payload].sort(byPosition);
        state.error = null;
      })
      // A failed edit leaves the loaded list as it was: `status` describes the fetch.
      .addCase(addBookmark.rejected, recordThunkError)
      .addCase(removeBookmark.fulfilled, (state, action) => {
        state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== action.payload);
        state.error = null;
      })
      .addCase(removeBookmark.rejected, recordThunkError)
      .addCase(updateBookmarkName.fulfilled, (state, action) => {
        const target = state.bookmarks.find((bookmark) => bookmark.id === action.payload.id);
        if (target) {
          target.name = action.payload.name;
        }
        state.error = null;
      })
      .addCase(updateBookmarkName.rejected, recordThunkError);
  },
});

export const { clearBookmarkError, clearBookmarks } = bookmarkSlice.actions;
export default bookmarkSlice.reducer;
