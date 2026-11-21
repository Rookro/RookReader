import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { api } from "../../bindings/api";
import type { BookWithState, Collection } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { createCommandThunk } from "../../store/createCommandThunk";
import { CommandError, ErrorCode } from "../../types/Error";

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

/** What adding books to the bookshelf did. */
export interface BookAdditionResult {
  /** How many paths are on the bookshelf now, books that were already there included. */
  added: number;
  /** Why each of the other paths could not be added, one code per path. */
  failures: ErrorCode[];
}

/**
 * Registers books and adds them to a collection, reporting how many could not be added
 * instead of failing on the first.
 *
 * @param collectionId - The collection to add the books to, or null for the library only.
 * @param seriesId - The series to put the added books in, at its end in the order of paths, or null.
 * @param paths - The files and folders to add; a folder is one book.
 * @returns A thunk that resolves to what was added.
 */
export const addBooksToBookshelf = createCommandThunk(
  "collection/addBooksToBookshelf",
  async ({
    collectionId,
    seriesId,
    paths,
  }: {
    collectionId: number | null;
    seriesId: number | null;
    paths: string[];
  }): Promise<BookAdditionResult> => {
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        const bookId = await api.registerBook(path);
        if (collectionId !== null) {
          await api.addBookToCollection(collectionId, bookId);
        }
        return bookId;
      }),
    );
    const toCode = (reason: unknown) =>
      reason instanceof CommandError ? reason.code : ErrorCode.other;
    const failures: ErrorCode[] = [];
    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        error(`Failed to add the book(${paths[i]}) to the bookshelf: ${String(result.reason)}`);
        failures.push(toCode(result.reason));
        continue;
      }
      if (seriesId === null) {
        continue;
      }
      // One at a time: each call appends at the series' end.
      try {
        await api.setSeriesForBook(result.value, seriesId);
      } catch (reason) {
        error(`Failed to put the book(${paths[i]}) in the series(${seriesId}): ${String(reason)}`);
        failures.push(toCode(reason));
      }
    }
    return { added: paths.length - failures.length, failures };
  },
  ({ collectionId }) => `Failed to add books to the collection of collectionId: ${collectionId}.`,
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
