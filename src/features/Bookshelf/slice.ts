import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { basename } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";
import {
  deleteBook,
  getAllBooksWithState,
  getBooksWithStateByBookshelfId,
  upsertBook,
} from "../../bindings/BookCommands";
import {
  addBookToBookshelf as addBookToBookshelfCommand,
  createBookshelf,
  deleteBookshelf,
  getAllBookshelves,
  removeBookFromBookshelf,
} from "../../bindings/BookshelfCommand";
import { determineEpubNovel, getEntriesInContainer } from "../../bindings/ContainerCommands";
import { createTag, deleteTag, getAllTags } from "../../bindings/TagCommands";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { Bookshelf, BookWithState, Series, Tag } from "../../types/DatabaseModels";
import { CommandError, ErrorCode } from "../../types/Error";

/**
 * Creates a new bookshelf and adds it to the database.
 *
 * @param params - The parameters for creating a bookshelf.
 * @param params.name - The name of the new bookshelf.
 * @param params.icon_id - The string identifier for the UI icon associated with the bookshelf.
 * @returns A thunk that resolves to the newly created Bookshelf object.
 */
export const addBookshelf = createAppAsyncThunk(
  "bookCollection/addBookshelf",
  async ({ name, icon_id }: { name: string; icon_id: string }, { rejectWithValue }) => {
    try {
      return await createBookshelf(name, icon_id);
    } catch (e) {
      const errorMessage = `Failed to add bookshelf(name: ${name}, icon_id: ${icon_id}). Error: ${JSON.stringify(e)}`;
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
 * Fetches all available bookshelves from the database.
 *
 * @returns A thunk that resolves to an array of all Bookshelf objects.
 */
export const fetchBookshelves = createAppAsyncThunk(
  "bookCollection/fetchBookshelves",
  async (_, { rejectWithValue }) => {
    try {
      return await getAllBookshelves();
    } catch (e) {
      const errorMessage = `Failed to fetch all available bookshelves. Error: ${JSON.stringify(e)}`;
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
 * Fetches books associated with a specific bookshelf ID.
 * If the ID is null, fetches all books in the database.
 *
 * @param bookshelfId - The ID of the bookshelf to fetch books for, or null for all books.
 * @returns A thunk that resolves to an array of BookWithState objects.
 */
export const fetchBooksInSelectedBookshelf = createAppAsyncThunk(
  "bookCollection/fetchBooksInSelectedBookshelf",
  async (bookshelfId: number | null, { rejectWithValue }) => {
    try {
      if (bookshelfId === null) {
        return await getAllBooksWithState();
      }
      return await getBooksWithStateByBookshelfId(bookshelfId);
    } catch (e) {
      const errorMessage = `Failed to fetch books in the bookshelf of bookshelfId: ${bookshelfId}. Error: ${JSON.stringify(e)}`;
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
 * Deletes a book from a specific bookshelf or completely from the database.
 * If a bookshelfId is provided, the book is only removed from that bookshelf.
 * If bookshelfId is null, the book is completely deleted from the database.
 *
 * @param params - The parameters for deletion.
 * @param params.bookId - The ID of the book to delete/remove.
 * @param params.bookshelfId - The ID of the bookshelf to remove the book from, or null to delete the book entirely.
 * @returns A thunk that resolves to the updated list of books for the current view.
 */
export const deleteBookFromCollection = createAppAsyncThunk(
  "bookCollection/deleteBookFromCollection",
  async (
    { bookId, bookshelfId }: { bookId: number; bookshelfId: number | null },
    { rejectWithValue },
  ) => {
    try {
      if (bookshelfId !== null) {
        await removeBookFromBookshelf(bookshelfId, bookId);
        return await getBooksWithStateByBookshelfId(bookshelfId);
      } else {
        await deleteBook(bookId);
        return await getAllBooksWithState();
      }
    } catch (e) {
      const errorMessage = `Failed to delete book with bookId: ${bookId}. Error: ${JSON.stringify(e)}`;
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
 * Adds a new book to the database and optionally to a specific bookshelf.
 * If the book is a container (like a ZIP or EPUB), it evaluates its contents first.
 *
 * @param params - The parameters for adding a book.
 * @param params.bookshelfId - The ID of the bookshelf to add the book to, or null if adding to the general collection.
 * @param params.bookPath - The absolute file path to the book or directory.
 * @returns A thunk that resolves to the updated list of books for the current view.
 */
export const addBookToBookshelf = createAppAsyncThunk(
  "bookCollection/addBookToBookshelf",
  async (
    { bookshelfId, bookPath }: { bookshelfId: number | null; bookPath: string },
    { rejectWithValue },
  ) => {
    try {
      const isEpubNovel = await determineEpubNovel(bookPath);
      let entriesResult: { entries: string[]; is_directory: boolean } | undefined;
      if (!isEpubNovel) {
        entriesResult = await getEntriesInContainer(bookPath);
      }

      const bookId = await upsertBook({
        filePath: bookPath,
        itemType: entriesResult?.is_directory ? "directory" : "file",
        totalPages: entriesResult?.entries.length ?? 0,
        displayName: await basename(bookPath),
      });

      if (bookshelfId !== null) {
        await addBookToBookshelfCommand(bookshelfId, bookId);
        return await getBooksWithStateByBookshelfId(bookshelfId);
      } else {
        return await getAllBooksWithState();
      }
    } catch (e) {
      const errorMessage = `Failed to add book(path: ${bookPath}) to bookshelf of bookshelfId: ${bookshelfId}. Error: ${JSON.stringify(e)}`;
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
 * Creates a new tag and adds it to the database.
 *
 * @param params - The parameters for creating a tag.
 * @param params.name - The name of the new tag.
 * @param params.color_code - The hex color code associated with the tag.
 * @returns A thunk that resolves to the newly created Tag object.
 */
export const addTag = createAppAsyncThunk(
  "bookCollection/addTag",
  async ({ name, color_code }: { name: string; color_code: string }, { rejectWithValue }) => {
    try {
      return await createTag(name, color_code);
    } catch (e) {
      const errorMessage = `Failed to add tag(name: ${name}, color_code: ${color_code}). Error: ${JSON.stringify(e)}`;
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
 * Fetches all available tags from the database.
 *
 * @returns A thunk that resolves to an array of all Tag objects.
 */
export const fetchTags = createAppAsyncThunk(
  "bookCollection/fetchTags",
  async (_, { rejectWithValue }) => {
    try {
      return await getAllTags();
    } catch (e) {
      const errorMessage = `Failed to fetch all available tags. Error: ${JSON.stringify(e)}`;
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
 * Deletes a bookshelf and refetches all bookshelves.
 *
 * @param id - The ID of the bookshelf to delete.
 * @returns A thunk that resolves when the bookshelf is deleted.
 */
export const removeBookshelf = createAppAsyncThunk(
  "bookCollection/removeBookshelf",
  async (id: number, { rejectWithValue, dispatch }) => {
    try {
      await deleteBookshelf(id);
      dispatch(fetchBookshelves());
      return id;
    } catch (e) {
      const errorMessage = `Failed to remove bookshelf(id: ${id}). Error: ${JSON.stringify(e)}`;
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
 * Deletes a tag and refetches all tags.
 *
 * @param id - The ID of the tag to delete.
 * @returns A thunk that resolves when the tag is deleted.
 */
export const removeTag = createAppAsyncThunk(
  "bookCollection/removeTag",
  async (id: number, { rejectWithValue, dispatch }) => {
    try {
      await deleteTag(id);
      dispatch(fetchTags());
      return id;
    } catch (e) {
      const errorMessage = `Failed to remove tag(id: ${id}). Error: ${JSON.stringify(e)}`;
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
 * Changes the currently selected bookshelf and fetches its corresponding books.
 * If the provided ID is null, fetches all books.
 *
 * @param id - The ID of the bookshelf to select, or null to clear selection and fetch all books.
 * @returns A thunk that resolves to an object containing the selected bookshelf ID and its corresponding array of books.
 */
export const changeBookshelf = createAppAsyncThunk(
  "bookCollection/changeBookshelf",
  async (id: number | null, { rejectWithValue }) => {
    try {
      if (id === null) {
        return { id, books: await getAllBooksWithState() };
      }
      return { id, books: await getBooksWithStateByBookshelfId(id) };
    } catch (e) {
      const errorMessage = `Failed to change bookshelf to id: ${id}. Error: ${JSON.stringify(e)}`;
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
 * Changes the currently selected tag and fetches books associated with it.
 * If the provided ID is null, clears the selection and returns an empty book list.
 *
 * @param id - The ID of the tag to select, or null to clear selection.
 * @returns A thunk that resolves to an object containing the selected tag ID and its corresponding array of books.
 */

const bookCollectionSlice = createSlice({
  name: "bookCollection",
  initialState: {
    searchText: "",
    bookshelf: {
      bookshelves: [] as Bookshelf[],
      selectedId: null as number | null,
      books: [] as BookWithState[],
      status: "idle" as "idle" | "loading" | "succeeded" | "failed",
      error: null as { code: ErrorCode; message?: string } | null,
    },
    tag: {
      tags: [] as Tag[],
      selectedId: null as number | null,
      status: "idle" as "idle" | "loading" | "succeeded" | "failed",
      error: null as { code: ErrorCode; message?: string } | null,
    },
    series: {
      series: [] as Series[],
      selectedId: null as number | null,
      books: [] as BookWithState[],
      status: "idle" as "idle" | "loading" | "succeeded" | "failed",
      error: null as { code: ErrorCode; message?: string } | null,
    },
  },
  reducers: {
    /**
     * Optimistically adds a newly created bookshelf to the state.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the new Bookshelf object.
     */
    bookshelfAdded(state, action: PayloadAction<Bookshelf>) {
      state.bookshelf.bookshelves.push(action.payload);
    },
    /**
     * Sets the currently selected tag ID in the state.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the selected tag ID, or null to clear.
     */
    setSelectedTag(state, action: PayloadAction<number | null>) {
      state.tag.selectedId = action.payload;
    },
    /**
     * Sets the search text specifically for the bookshelf view.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the search text.
     */
    setBookshelfSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    /**
     * Sets the global search text for the book collection.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the search text.
     */
    setSearchText(state, action: PayloadAction<string>) {
      state.searchText = action.payload;
    },
    /**
     * Clears any error associated with the bookshelf state.
     *
     * @param state - The current Redux state slice.
     */
    clearBookshelfError: (state) => {
      state.bookshelf.error = null;
    },
    /**
     * Clears any error associated with the tag state.
     *
     * @param state - The current Redux state slice.
     */
    clearTagError: (state) => {
      state.tag.error = null;
    },
    /**
     * Clears any error associated with the series state.
     *
     * @param state - The current Redux state slice.
     */
    clearSeriesError: (state) => {
      state.series.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addBookshelf.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(addBookshelf.fulfilled, (state, action) => {
        state.bookshelf.status = "succeeded";
        state.bookshelf.bookshelves.push(action.payload);
        state.bookshelf.error = null;
      })
      .addCase(addBookshelf.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(fetchBookshelves.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(fetchBookshelves.fulfilled, (state, action) => {
        state.bookshelf.status = "succeeded";
        state.bookshelf.bookshelves = action.payload;
        state.bookshelf.error = null;
      })
      .addCase(fetchBookshelves.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.bookshelves = [];
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(fetchBooksInSelectedBookshelf.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(fetchBooksInSelectedBookshelf.fulfilled, (state, action) => {
        state.bookshelf.status = "succeeded";
        state.bookshelf.books = action.payload;
        state.bookshelf.error = null;
      })
      .addCase(fetchBooksInSelectedBookshelf.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.books = [];
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(deleteBookFromCollection.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(deleteBookFromCollection.fulfilled, (state, action) => {
        state.bookshelf.status = "succeeded";
        state.bookshelf.books = action.payload;
        state.bookshelf.error = null;
      })
      .addCase(deleteBookFromCollection.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(addBookToBookshelf.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(addBookToBookshelf.fulfilled, (state, action) => {
        state.bookshelf.status = "succeeded";
        state.bookshelf.books = action.payload;
        state.bookshelf.error = null;
      })
      .addCase(addBookToBookshelf.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(changeBookshelf.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(changeBookshelf.fulfilled, (state, action) => {
        state.bookshelf.status = "succeeded";
        state.bookshelf.selectedId = action.payload.id;
        state.bookshelf.books = action.payload.books;
        state.bookshelf.error = null;
      })
      .addCase(changeBookshelf.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.selectedId = null;
        state.bookshelf.books = [];
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(removeBookshelf.pending, (state) => {
        state.bookshelf.status = "loading";
        state.bookshelf.error = null;
      })
      .addCase(removeBookshelf.fulfilled, (state, action) => {
        if (state.bookshelf.selectedId === action.payload) {
          state.bookshelf.selectedId = null;
        }
      })
      .addCase(removeBookshelf.rejected, (state, action) => {
        state.bookshelf.status = "failed";
        state.bookshelf.error = action.payload ?? null;
      })
      .addCase(removeTag.pending, (state) => {
        state.tag.status = "loading";
        state.tag.error = null;
      })
      .addCase(removeTag.fulfilled, (state, action) => {
        if (state.tag.selectedId === action.payload) {
          state.tag.selectedId = null;
        }
      })
      .addCase(removeTag.rejected, (state, action) => {
        state.tag.status = "failed";
        state.tag.error = action.payload ?? null;
      })
      .addCase(addTag.pending, (state) => {
        state.tag.status = "loading";
        state.tag.error = null;
      })
      .addCase(addTag.fulfilled, (state, action) => {
        state.tag.status = "succeeded";
        state.tag.tags.push(action.payload);
        state.tag.error = null;
      })
      .addCase(addTag.rejected, (state, action) => {
        state.tag.status = "failed";
        state.tag.error = action.payload ?? null;
      })
      .addCase(fetchTags.pending, (state) => {
        state.tag.status = "loading";
        state.tag.error = null;
      })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.tag.status = "succeeded";
        state.tag.tags = action.payload;
        state.tag.error = null;
      })
      .addCase(fetchTags.rejected, (state, action) => {
        state.tag.status = "failed";
        state.tag.tags = [];
        state.tag.error = action.payload ?? null;
      });
  },
});

export const {
  bookshelfAdded,
  setSelectedTag,
  setBookshelfSearchText,
  setSearchText,
  clearBookshelfError,
  clearTagError,
  clearSeriesError,
} = bookCollectionSlice.actions;
export default bookCollectionSlice.reducer;
