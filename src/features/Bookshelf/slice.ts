import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api } from "../../bindings/api";
import type { BookWithState, Collection } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { createCommandThunk } from "../../store/createCommandThunk";

/**
 * Creates a new collection and adds it to the database.
 *
 * @param params - The parameters for creating a collection.
 * @param params.name - The name of the new collection.
 * @param params.iconId - The string identifier for the UI icon associated with the collection.
 * @returns A thunk that resolves to the newly created Collection object.
 */
export const addCollection = createCommandThunk(
  "collection/addCollection",
  ({ name, iconId }: { name: string; iconId: string }) => api.createCollection(name, iconId),
  ({ name, iconId }) => `Failed to add collection(name: ${name}, iconId: ${iconId}).`,
);

/**
 * Fetches all available collections from the database.
 *
 * @returns A thunk that resolves to an array of all Collection objects.
 */
export const fetchCollections = createCommandThunk(
  "collection/fetchCollections",
  () => api.getAllCollections(),
  () => "Failed to fetch all available collections.",
);

/**
 * Fetches books associated with a specific collection ID.
 * If the ID is null, fetches all books in the database.
 *
 * @param collectionId - The ID of the collection to fetch books for, or null for all books.
 * @returns A thunk that resolves to an array of BookWithState objects.
 */
export const fetchBooksInSelectedCollection = createCommandThunk(
  "collection/fetchBooksInSelectedCollection",
  async (collectionId: number | null) => {
    if (collectionId === null) {
      return await api.getAllBooksWithState();
    }
    return await api.getBooksByCollection(collectionId);
  },
  (collectionId) => `Failed to fetch books in the collection of collectionId: ${collectionId}.`,
  (collectionId, { getState, requestId }) => {
    const { booksRequestId, selectedId } = getState().collection;
    return booksRequestId !== requestId || selectedId !== collectionId;
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
export const deleteBookFromCollection = createCommandThunk(
  "collection/deleteBookFromCollection",
  async ({ bookId, collectionId }: { bookId: number; collectionId: number | null }) => {
    if (collectionId !== null) {
      await api.removeBookFromCollection(collectionId, bookId);
    } else {
      await api.deleteBook(bookId);
    }
  },
  ({ bookId }) => `Failed to delete book with bookId: ${bookId}.`,
);

/**
 * Saves a new collection set for each given book.
 *
 * @param updates - Each book with the complete set of collections that should contain it.
 * @returns A thunk that resolves when every book is updated.
 */
export const setCollectionsForBooks = createCommandThunk(
  "collection/setCollectionsForBooks",
  async (updates: { bookId: number; collectionIds: number[] }[]) => {
    await Promise.all(
      updates.map(({ bookId, collectionIds }) => api.setCollectionsForBook(bookId, collectionIds)),
    );
  },
  () => "Failed to set collections for books.",
);

/**
 * Adds a new book to the database and optionally to a specific collection.
 * If the book is a container (like a ZIP or EPUB), it evaluates its contents first.
 *
 * @param params - The parameters for adding a book.
 * @param params.collectionId - The ID of the collection to add the book to, or null to add it to the library only.
 * @param params.bookPath - The absolute file path to the book or directory.
 * @returns A thunk that resolves to the updated list of books for the current view.
 */
export const addBookToBookshelf = createCommandThunk(
  "collection/addBookToBookshelf",
  async ({ collectionId, bookPath }: { collectionId: number | null; bookPath: string }) => {
    const bookId = await api.registerBook(bookPath);

    if (collectionId !== null) {
      await api.addBookToCollection(collectionId, bookId);
    }
  },
  ({ collectionId, bookPath }) =>
    `Failed to add book(path: ${bookPath}) to collection of collectionId: ${collectionId}.`,
);

/**
 * Deletes a collection and refetches all collections. Deleting the selected collection
 * selects "All Books".
 *
 * @param id - The ID of the collection to delete.
 * @returns A thunk that resolves when the collection is deleted.
 */
export const removeCollection = createCommandThunk(
  "collection/removeCollection",
  async (id: number, { dispatch, getState }) => {
    await api.deleteCollection(id);
    if (getState().collection.selectedId === id) {
      dispatch(setSelectedCollection(null));
    }
    return id;
  },
  (id) => `Failed to remove collection(id: ${id}).`,
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
     * driven by the `useLibrarySync` effect that watches `selectedId`; keeping this
     * a plain reducer avoids duplicating the fetch logic in a thunk.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the collection ID to select, or null for all books.
     */
    setSelectedCollection(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // The collection list is not the grid's books, so `status` is left alone.
      .addCase(fetchCollections.fulfilled, (state, action) => {
        state.collections = action.payload;
      })
      .addCase(fetchCollections.rejected, (state) => {
        state.collections = [];
      })
      .addCase(fetchBooksInSelectedCollection.pending, (state, action) => {
        state.booksRequestId = action.meta.requestId;
        // Another collection shows a spinner; the same collection refreshes in place.
        if (state.booksCollection === null || state.booksCollection.id !== action.meta.arg) {
          state.status = "loading";
        } else {
          state.isRefreshing = true;
        }
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
      })
      .addCase(readingProgressChanged, (state, action) => {
        // Patch the book if it is in this collection; a page turn never adds one to it.
        const book = state.books.find((b) => b.id === action.payload.bookId);
        if (book) {
          book.lastReadPageIndex = action.payload.lastReadPageIndex;
          book.cfi = action.payload.cfi;
          book.lastOpenedAt = action.payload.lastOpenedAt ?? book.lastOpenedAt;
        }
      });
  },
});

export const { collectionAdded, setSearchText, setSelectedCollection } = collectionSlice.actions;
export default collectionSlice.reducer;
