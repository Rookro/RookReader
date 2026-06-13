import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { basename } from "@tauri-apps/api/path";
import {
  deleteBook,
  getAllBooksWithState,
  getBooksWithStateByBookshelfId,
  registerBook,
} from "../../bindings/BookCommands";
import {
  addBookToBookshelf as addBookToBookshelfCommand,
  createBookshelf,
  deleteBookshelf,
  getAllBookshelves,
  removeBookFromBookshelf,
} from "../../bindings/BookshelfCommand";
import { getEntriesInContainer } from "../../bindings/ContainerCommands";
import type { BookWithState } from "../../domain/book/schema";
import type { Bookshelf } from "../../domain/bookshelf/schema";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { ErrorCode } from "../../types/Error";

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
      return handleThunkError(
        e,
        `Failed to add bookshelf(name: ${name}, icon_id: ${icon_id}).`,
        rejectWithValue,
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
      return handleThunkError(e, "Failed to fetch all available bookshelves.", rejectWithValue);
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
      return handleThunkError(
        e,
        `Failed to fetch books in the bookshelf of bookshelfId: ${bookshelfId}.`,
        rejectWithValue,
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
      } else {
        await deleteBook(bookId);
      }
    } catch (e) {
      return handleThunkError(e, `Failed to delete book with bookId: ${bookId}.`, rejectWithValue);
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
      const [entriesResult, fileName] = await Promise.all([
        getEntriesInContainer(bookPath),
        basename(bookPath),
      ]);

      const bookId = await registerBook({
        filePath: bookPath,
        itemType: entriesResult.is_directory ? "directory" : "file",
        totalPages: entriesResult.entries.length,
        displayName: fileName,
      });

      if (bookshelfId !== null) {
        await addBookToBookshelfCommand(bookshelfId, bookId);
      }
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to add book(path: ${bookPath}) to bookshelf of bookshelfId: ${bookshelfId}.`,
        rejectWithValue,
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
  async (id: number, { rejectWithValue }) => {
    try {
      await deleteBookshelf(id);
      return id;
    } catch (e) {
      return handleThunkError(e, `Failed to remove bookshelf(id: ${id}).`, rejectWithValue);
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
      return handleThunkError(e, `Failed to change bookshelf to id: ${id}.`, rejectWithValue);
    }
  },
);

const bookCollectionSlice = createSlice({
  name: "bookCollection",
  initialState: {
    searchText: "",
    bookshelves: [] as Bookshelf[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as { code: ErrorCode; message?: string } | null,
  },
  reducers: {
    /**
     * Optimistically adds a newly created bookshelf to the state.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the new Bookshelf object.
     */
    bookshelfAdded(state, action: PayloadAction<Bookshelf>) {
      state.bookshelves.push(action.payload);
    },
    /**
     * Sets the search text for the bookshelf view.
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
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addBookshelf.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(addBookshelf.fulfilled, (state) => {
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(addBookshelf.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(fetchBookshelves.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchBookshelves.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.bookshelves = action.payload;
        state.error = null;
      })
      .addCase(fetchBookshelves.rejected, (state, action) => {
        state.status = "failed";
        state.bookshelves = [];
        state.error = action.payload ?? null;
      })
      .addCase(fetchBooksInSelectedBookshelf.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchBooksInSelectedBookshelf.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.books = action.payload;
        state.error = null;
      })
      .addCase(fetchBooksInSelectedBookshelf.rejected, (state, action) => {
        state.status = "failed";
        state.books = [];
        state.error = action.payload ?? null;
      })
      .addCase(deleteBookFromCollection.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(deleteBookFromCollection.fulfilled, (state) => {
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(deleteBookFromCollection.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(addBookToBookshelf.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(addBookToBookshelf.fulfilled, (state) => {
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(addBookToBookshelf.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(changeBookshelf.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(changeBookshelf.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.selectedId = action.payload.id;
        state.books = action.payload.books;
        state.error = null;
      })
      .addCase(changeBookshelf.rejected, (state, action) => {
        state.status = "failed";
        state.selectedId = null;
        state.books = [];
        state.error = action.payload ?? null;
      })
      .addCase(removeBookshelf.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(removeBookshelf.fulfilled, (state, action) => {
        if (state.selectedId === action.payload) {
          state.selectedId = null;
        }
      })
      .addCase(removeBookshelf.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      });
  },
});

export const { bookshelfAdded, setSearchText, clearBookshelfError } = bookCollectionSlice.actions;
export default bookCollectionSlice.reducer;
