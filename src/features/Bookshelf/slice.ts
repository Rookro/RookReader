import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  deleteBook,
  getAllBooksWithState,
  getBooksWithStateByCollectionId,
  registerBook,
} from "../../bindings/BookCommands";
import {
  addBookToCollection,
  createCollection,
  deleteCollection,
  getAllCollections,
  removeBookFromCollection,
  setCollectionsForBook,
} from "../../bindings/CollectionCommands";
import type { BookWithState, Collection } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { ErrorCode } from "../../types/Error";

/**
 * Creates a new collection and adds it to the database.
 *
 * @param params - The parameters for creating a collection.
 * @param params.name - The name of the new collection.
 * @param params.icon_id - The string identifier for the UI icon associated with the collection.
 * @returns A thunk that resolves to the newly created Collection object.
 */
export const addCollection = createAppAsyncThunk(
  "collection/addCollection",
  async ({ name, icon_id }: { name: string; icon_id: string }, { rejectWithValue }) => {
    try {
      return await createCollection(name, icon_id);
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to add collection(name: ${name}, icon_id: ${icon_id}).`,
        rejectWithValue,
      );
    }
  },
);

/**
 * Fetches all available collections from the database.
 *
 * @returns A thunk that resolves to an array of all Collection objects.
 */
export const fetchCollections = createAppAsyncThunk(
  "collection/fetchCollections",
  async (_, { rejectWithValue }) => {
    try {
      return await getAllCollections();
    } catch (e) {
      return handleThunkError(e, "Failed to fetch all available collections.", rejectWithValue);
    }
  },
);

/**
 * Fetches books associated with a specific collection ID.
 * If the ID is null, fetches all books in the database.
 *
 * @param collectionId - The ID of the collection to fetch books for, or null for all books.
 * @returns A thunk that resolves to an array of BookWithState objects.
 */
export const fetchBooksInSelectedCollection = createAppAsyncThunk(
  "collection/fetchBooksInSelectedCollection",
  async (collectionId: number | null, { rejectWithValue }) => {
    try {
      if (collectionId === null) {
        return await getAllBooksWithState();
      }
      return await getBooksWithStateByCollectionId(collectionId);
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to fetch books in the collection of collectionId: ${collectionId}.`,
        rejectWithValue,
      );
    }
  },
);

/**
 * Deletes a book from a specific collection or completely from the database.
 * If a collectionId is provided, the book is only removed from that collection.
 * If collectionId is null, the book is completely deleted from the database.
 *
 * @param params - The parameters for deletion.
 * @param params.bookId - The ID of the book to delete/remove.
 * @param params.collectionId - The ID of the collection to remove the book from, or null to delete the book entirely.
 * @returns A thunk that resolves to the updated list of books for the current view.
 */
export const deleteBookFromCollection = createAppAsyncThunk(
  "collection/deleteBookFromCollection",
  async (
    { bookId, collectionId }: { bookId: number; collectionId: number | null },
    { rejectWithValue },
  ) => {
    try {
      if (collectionId !== null) {
        await removeBookFromCollection(collectionId, bookId);
      } else {
        await deleteBook(bookId);
      }
    } catch (e) {
      return handleThunkError(e, `Failed to delete book with bookId: ${bookId}.`, rejectWithValue);
    }
  },
);

/**
 * Saves a new collection set for each given book.
 *
 * @param updates - Each book with the complete set of collections that should contain it.
 * @returns A thunk that resolves when every book is updated.
 */
export const setCollectionsForBooks = createAppAsyncThunk(
  "collection/setCollectionsForBooks",
  async (updates: { bookId: number; collectionIds: number[] }[], { rejectWithValue }) => {
    try {
      await Promise.all(
        updates.map(({ bookId, collectionIds }) => setCollectionsForBook(bookId, collectionIds)),
      );
    } catch (e) {
      return handleThunkError(e, "Failed to set collections for books.", rejectWithValue);
    }
  },
);

/**
 * Adds a new book to the database and optionally to a specific collection.
 * If the book is a container (like a ZIP or EPUB), it evaluates its contents first.
 *
 * @param params - The parameters for adding a book.
 * @param params.collectionId - The ID of the collection to add the book to, or null if adding to the general collection.
 * @param params.bookPath - The absolute file path to the book or directory.
 * @returns A thunk that resolves to the updated list of books for the current view.
 */
export const addBookToBookshelf = createAppAsyncThunk(
  "collection/addBookToBookshelf",
  async (
    { collectionId, bookPath }: { collectionId: number | null; bookPath: string },
    { rejectWithValue },
  ) => {
    try {
      const bookId = await registerBook(bookPath);

      if (collectionId !== null) {
        await addBookToCollection(collectionId, bookId);
      }
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to add book(path: ${bookPath}) to collection of collectionId: ${collectionId}.`,
        rejectWithValue,
      );
    }
  },
);

/**
 * Deletes a collection and refetches all collections. Deleting the selected collection
 * selects "All Books".
 *
 * @param id - The ID of the collection to delete.
 * @returns A thunk that resolves when the collection is deleted.
 */
export const removeCollection = createAppAsyncThunk(
  "collection/removeCollection",
  async (id: number, { rejectWithValue, dispatch, getState }) => {
    try {
      await deleteCollection(id);
      if (getState().collection.selectedId === id) {
        dispatch(setSelectedCollection(null));
      }
      return id;
    } catch (e) {
      return handleThunkError(e, `Failed to remove collection(id: ${id}).`, rejectWithValue);
    }
  },
);

const collectionSlice = createSlice({
  name: "collection",
  initialState: {
    searchText: "",
    collections: [] as Collection[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    /** The collection `books` holds (id null for all books), or null before the first load. */
    booksCollection: null as { id: number | null } | null,
    /** The latest books request; only its answer may replace `books`. */
    booksRequestId: null as string | null,
    /** Whether the collection on screen is being refetched in place. */
    isRefreshing: false,
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
    error: null as { code: ErrorCode; message?: string } | null,
  },
  reducers: {
    /**
     * Optimistically adds a newly created collection to the state.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the new Collection object.
     */
    collectionAdded(state, action: PayloadAction<Collection>) {
      state.collections.push(action.payload);
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
     * Selects a collection (or null for "all books"). The actual book fetch is
     * driven by the `useHistorySync` effect that watches `selectedId`; keeping this
     * a plain reducer avoids duplicating the fetch logic in a thunk.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the collection ID to select, or null for all books.
     */
    setSelectedCollection(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
    },
    /**
     * Clears any error associated with the collection state.
     *
     * @param state - The current Redux state slice.
     */
    clearCollectionError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Mutations record only their error: `status` describes the books on screen, and
      // flipping it to "loading" would blank the grid and lose its scroll position.
      .addCase(addCollection.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(deleteBookFromCollection.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(addBookToBookshelf.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(removeCollection.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(setCollectionsForBooks.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      // The collection list is not the grid's books either.
      .addCase(fetchCollections.fulfilled, (state, action) => {
        state.collections = action.payload;
      })
      .addCase(fetchCollections.rejected, (state, action) => {
        state.collections = [];
        state.error = action.payload ?? null;
      })
      .addCase(fetchBooksInSelectedCollection.pending, (state, action) => {
        state.booksRequestId = action.meta.requestId;
        // Another collection shows a spinner; the same collection refreshes in place.
        if (state.booksCollection === null || state.booksCollection.id !== action.meta.arg) {
          state.status = "loading";
        } else {
          state.isRefreshing = true;
        }
        state.error = null;
      })
      .addCase(fetchBooksInSelectedCollection.fulfilled, (state, action) => {
        // Ignore a response superseded by a newer request, or for a collection the user left.
        if (
          action.meta.requestId !== state.booksRequestId ||
          action.meta.arg !== state.selectedId
        ) {
          return;
        }
        state.status = "succeeded";
        state.isRefreshing = false;
        state.books = action.payload;
        state.booksCollection = { id: action.meta.arg };
        state.error = null;
      })
      .addCase(fetchBooksInSelectedCollection.rejected, (state, action) => {
        if (
          action.meta.requestId !== state.booksRequestId ||
          action.meta.arg !== state.selectedId
        ) {
          return;
        }
        state.status = "failed";
        state.isRefreshing = false;
        state.books = [];
        state.booksCollection = null;
        state.error = action.payload ?? null;
      })
      .addCase(readingProgressChanged, (state, action) => {
        // A page turn cannot change list membership or order (last_opened_at is only
        // set when a book is opened), so patch the matching entry in place.
        const book = state.books.find((b) => b.id === action.payload.book_id);
        if (book) {
          book.last_read_page_index = action.payload.last_read_page_index;
          book.last_opened_at = action.payload.last_opened_at ?? book.last_opened_at;
        }
      });
  },
});

export const { collectionAdded, setSearchText, setSelectedCollection, clearCollectionError } =
  collectionSlice.actions;
export default collectionSlice.reducer;
