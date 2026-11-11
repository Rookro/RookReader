import { createSlice } from "@reduxjs/toolkit";
import { api } from "../../bindings/api";
import type { Bookmark } from "../../domain/entities";
import { createCommandThunk } from "../../types/CustomAsyncThunk";

/**
 * Fetches all bookmarks of a book.
 *
 * @param bookId - The ID of the book whose bookmarks to fetch.
 * @returns A thunk that resolves to the book's bookmarks.
 */
export const fetchBookmarks = createCommandThunk(
  "bookmark/fetchBookmarks",
  (bookId: number) => api.getBookmarksByBookId(bookId),
  (bookId) => `Failed to fetch bookmarks(bookId: ${bookId}).`,
  (bookId, { getState }) => getState().bookmark.bookId !== bookId,
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
    api.createBookmark(params.bookId, params.name, params.pageIndex, params.cfi),
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
    await api.deleteBookmark(id);
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
    await api.renameBookmark(params.id, params.name);
    return params;
  },
  (params) => `Failed to rename bookmark(id: ${params.id}).`,
);

/** Orders bookmarks by their position in the book, mirroring the backend's ordering. */
const byPosition = (a: Bookmark, b: Bookmark) =>
  a.pageIndex - b.pageIndex || a.createdAt.localeCompare(b.createdAt) || a.id - b.id;

const bookmarkSlice = createSlice({
  name: "bookmark",
  initialState: {
    /** The book `bookmarks` belongs to, or null when no list is loaded. */
    bookId: null as number | null,
    bookmarks: [] as Bookmark[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
  },
  reducers: {
    /**
     * Forgets the loaded list, for when no book is open.
     *
     * @param state - The current Redux state slice.
     */
    clearBookmarks: (state) => {
      state.bookId = null;
      state.bookmarks = [];
      state.status = "idle";
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
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        // A late answer for a book that is no longer open.
        if (action.meta.arg !== state.bookId) {
          return;
        }
        state.status = "succeeded";
        state.bookmarks = action.payload;
      })
      .addCase(fetchBookmarks.rejected, (state, action) => {
        if (action.meta.arg !== state.bookId) {
          return;
        }
        state.status = "failed";
        state.bookmarks = [];
      })
      .addCase(addBookmark.fulfilled, (state, action) => {
        if (action.payload.bookId !== state.bookId) {
          return;
        }
        state.bookmarks = [...state.bookmarks, action.payload].sort(byPosition);
      })
      .addCase(removeBookmark.fulfilled, (state, action) => {
        state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== action.payload);
      })
      .addCase(updateBookmarkName.fulfilled, (state, action) => {
        const target = state.bookmarks.find((bookmark) => bookmark.id === action.payload.id);
        if (target) {
          target.name = action.payload.name;
        }
      });
  },
});

export const { clearBookmarks } = bookmarkSlice.actions;
export default bookmarkSlice.reducer;
