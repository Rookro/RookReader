import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../bindings/api";
import type { BookWithState, Collection, Series, Tag } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { createMockBookWithState, createMockCollection, createMockTag } from "../../test/factories";
import { type AppStore, createBasePreloadedState, createTestStore } from "../../test/utils";
import { CommandError, ErrorCode } from "../../types/Error";
import seriesReducer, {
  addSeries,
  fetchSeries,
  removeSeries,
  setSelectedSeriesId,
  updateBooksSeries,
  updateSeriesOrdersThunk,
} from "./seriesSlice";
import collectionReducer, {
  addBookToBookshelf,
  addCollection,
  collectionAdded,
  deleteBookFromCollection,
  fetchBooksInSelectedCollection,
  fetchCollections,
  removeCollection,
  setCollectionsForBooks,
  setSearchText,
  setSelectedCollection,
} from "./slice";
import tagReducer, {
  addTag,
  fetchTags,
  removeTag,
  setSelectedTag,
  updateBooksTags,
} from "./tagSlice";

describe("CollectionReducer", () => {
  let store: AppStore;

  const collectionInitialState = {
    searchText: "",
    collections: [] as Collection[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    booksCollection: null as { id: number | null } | null,
    booksRequestId: null as string | null,
    isRefreshing: false,
    status: "idle" as "idle" | "loading" | "succeeded" | "failed",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is set correctly
  it("should handle initial state", () => {
    expect(collectionReducer(undefined, { type: "unknown" })).toEqual(collectionInitialState);
  });

  // Verify that search text is set correctly
  it("should handle setSearchText", () => {
    const nextState = collectionReducer(collectionInitialState, setSearchText("query"));
    expect(nextState.searchText).toBe("query");
  });

  // Verify that state is updated when a collection is added
  it("should handle collectionAdded", () => {
    const newCollection = createMockCollection({ id: 1, name: "New" });
    const nextState = collectionReducer(collectionInitialState, collectionAdded(newCollection));
    expect(nextState.collections).toContainEqual(newCollection);
  });

  // Verify that readingProgressChanged patches the matching book in place.
  it("should patch the matching book on readingProgressChanged", () => {
    const state = {
      ...collectionInitialState,
      books: [
        createMockBookWithState({ id: 1, lastReadPageIndex: 0 }),
        createMockBookWithState({ id: 2, lastReadPageIndex: 5 }),
      ],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        bookId: 2,
        lastReadPageIndex: 9,
        cfi: null,
        lastOpenedAt: "2026-07-04T10:00:00Z",
      }),
    );
    expect(nextState.books[0].lastReadPageIndex).toBe(0);
    expect(nextState.books[1].lastReadPageIndex).toBe(9);
    expect(nextState.books[1].lastOpenedAt).toBe("2026-07-04T10:00:00Z");
  });

  // A progress update without a timestamp does not blank the listed one.
  it("should keep lastOpenedAt when readingProgressChanged carries none", () => {
    const state = {
      ...collectionInitialState,
      books: [
        createMockBookWithState({
          id: 1,
          lastReadPageIndex: 0,
          lastOpenedAt: "2026-07-01T09:00:00Z",
        }),
      ],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        bookId: 1,
        lastReadPageIndex: 4,
        cfi: null,
        lastOpenedAt: null,
      }),
    );
    expect(nextState.books[0].lastReadPageIndex).toBe(4);
    expect(nextState.books[0].lastOpenedAt).toBe("2026-07-01T09:00:00Z");
  });

  it("should patch the matching book's position on readingProgressChanged", () => {
    const state = {
      ...collectionInitialState,
      books: [createMockBookWithState({ id: 2, cfi: null })],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        bookId: 2,
        lastReadPageIndex: 3,
        cfi: "epubcfi(/6/8!/4/2/1:0)",
        lastOpenedAt: null,
      }),
    );
    expect(nextState.books[0].cfi).toBe("epubcfi(/6/8!/4/2/1:0)");
  });

  // Verify that readingProgressChanged for an unknown book id is a no-op.
  it("should ignore readingProgressChanged for an unknown book id", () => {
    const state = {
      ...collectionInitialState,
      books: [createMockBookWithState({ id: 1, lastReadPageIndex: 3 })],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        bookId: 999,
        lastReadPageIndex: 42,
        cfi: null,
        lastOpenedAt: "2026-07-04T10:00:00Z",
      }),
    );
    expect(nextState.books[0].lastReadPageIndex).toBe(3);
  });

  describe("grid stays mounted while books reload", () => {
    const initial = collectionReducer(undefined, { type: "unknown" });

    // Scrolling deep into a shelf and tagging a book must not reset the grid to the top
    it("keeps the grid when the same shelf refetches", () => {
      const loaded = {
        ...initial,
        selectedId: 1,
        booksCollection: { id: 1 },
        status: "succeeded" as const,
      };
      const state = collectionReducer(loaded, fetchBooksInSelectedCollection.pending("r2", 1));
      expect(state.status).toBe("succeeded");
      expect(state.isRefreshing).toBe(true);
    });

    it("shows loading when another shelf is fetched", () => {
      const loaded = {
        ...initial,
        selectedId: 2,
        booksCollection: { id: 1 },
        status: "succeeded" as const,
      };
      expect(
        collectionReducer(loaded, fetchBooksInSelectedCollection.pending("r2", 2)).status,
      ).toBe("loading");
    });

    it("drops an older response for the same shelf", () => {
      let state: typeof initial = { ...initial, selectedId: 1, booksCollection: { id: 1 } };
      state = collectionReducer(state, fetchBooksInSelectedCollection.pending("r1", 1));
      state = collectionReducer(state, fetchBooksInSelectedCollection.pending("r2", 1));
      state = collectionReducer(
        state,
        fetchBooksInSelectedCollection.fulfilled([createMockBookWithState({ id: 9 })], "r1", 1),
      );
      expect(state.books).toEqual(initial.books);
      expect(state.isRefreshing).toBe(true);
    });

    // A failed load holds no shelf's books, so the next load of any shelf shows the spinner
    it("forgets which shelf it holds after a failed load", () => {
      let state: typeof initial = { ...initial, selectedId: 1, booksCollection: { id: 1 } };
      state = collectionReducer(state, fetchBooksInSelectedCollection.pending("r1", 1));
      state = collectionReducer(
        state,
        fetchBooksInSelectedCollection.rejected(null, "r1", 1, { code: ErrorCode.database }),
      );
      expect(state.booksCollection).toBeNull();
      expect(collectionReducer(state, fetchBooksInSelectedCollection.pending("r2", 1)).status).toBe(
        "loading",
      );
    });

    it.each([
      ["addCollection", addCollection.pending("r", { name: "n", iconId: "i" })],
      [
        "deleteBookFromCollection",
        deleteBookFromCollection.pending("r", { bookId: 1, collectionId: null }),
      ],
      [
        "addBookToBookshelf",
        addBookToBookshelf.pending("r", { collectionId: 1, bookPath: "/b.zip" }),
      ],
      ["removeCollection", removeCollection.pending("r", 1)],
      ["fetchCollections", fetchCollections.pending("r")],
    ])("%s does not blank the grid", (_, action) => {
      const loaded = { ...initial, status: "succeeded" as const };
      expect(collectionReducer(loaded, action).status).toBe("succeeded");
    });
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify state update when rejected actions have undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const action = { type: addCollection.rejected.type, payload: undefined };
      const nextState = collectionReducer(collectionInitialState, action);
      expect(nextState.status).toBe("idle");
    });

    describe("Collection Thunks", () => {
      // Verify that collection list is updated on success
      it("fetchCollections should update state with fetched collections on success", async () => {
        const mockCollections = [createMockCollection({ id: 1, name: "BS1" })];
        vi.mocked(api.getAllCollections).mockResolvedValue(mockCollections);

        await store.dispatch(fetchCollections());

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
      });

      // Verify handling of CommandError when fetching collections
      it("fetchCollections should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "failed");
        vi.mocked(api.getAllCollections).mockRejectedValue(mockError);

        await store.dispatch(fetchCollections());

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.io },
        ]);
      });

      // Verify error handling when collection fetching fails
      it("fetchCollections should handle generic Error and clear collections", async () => {
        const mockError = new Error("failed");
        vi.mocked(api.getAllCollections).mockRejectedValue(mockError);

        // Pre-fill state to verify clearing
        const preloadedState = {
          collection: {
            ...collectionInitialState,
            collections: [createMockCollection()],
          },
        };
        store = createTestStore(preloadedState);

        await store.dispatch(fetchCollections());

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]);
        expect(state.collections).toEqual([]);
      });

      // Verify state update on successful collection creation
      it("addCollection should leave the grid status alone on success", async () => {
        const mockCollection = createMockCollection({ id: 1, name: "New BS" });
        vi.mocked(api.createCollection).mockResolvedValue(mockCollection);

        await store.dispatch(addCollection({ name: "New BS", iconId: "folder" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
      });

      // Verify handling of CommandError during collection creation
      it("addCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "io error");
        vi.mocked(api.createCollection).mockRejectedValue(mockError);

        await store.dispatch(addCollection({ name: "Existing BS", iconId: "folder" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.io },
        ]);
      });

      // Verify handling of generic Error during collection creation
      it("addCollection should handle generic Error", async () => {
        const mockError = new Error("unknown error");
        vi.mocked(api.createCollection).mockRejectedValue(mockError);

        await store.dispatch(addCollection({ name: "Error BS", iconId: "folder" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]);
      });

      // Verify error handling when collection removal fails with no payload
      // Verify error handling when collection removal fails with no payload
      it("removeCollection should handle failure with no payload", async () => {
        vi.mocked(api.deleteCollection).mockImplementation(() => {
          throw new Error("fail");
        });

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]);
      });

      // Verify that selectedId is reset if the selected collection is deleted
      it("removeCollection should update selectedId if deleted", async () => {
        const preloadedState = {
          collection: structuredClone(collectionInitialState),
        };
        preloadedState.collection.selectedId = 1;

        store = createTestStore(preloadedState);
        vi.mocked(api.deleteCollection).mockResolvedValue(null);
        vi.mocked(api.getAllCollections).mockResolvedValue([]);

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.selectedId).toBeNull();
      });

      // Verify that selectedId is maintained if a different collection is deleted
      it("removeCollection should not change selectedId if different ID deleted", async () => {
        const preloadedState = {
          collection: structuredClone(collectionInitialState),
        };
        preloadedState.collection.selectedId = 2;

        store = createTestStore(preloadedState);
        vi.mocked(api.deleteCollection).mockResolvedValue(null);

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.selectedId).toBe(2);
      });

      // Verify error handling when collection removal fails
      it("removeCollection should handle generic failure", async () => {
        vi.mocked(api.deleteCollection).mockRejectedValue(new Error());

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]);
      });

      // Verify CommandError handling when collection removal fails
      it("removeCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.database, "db fail");
        vi.mocked(api.deleteCollection).mockRejectedValue(mockError);

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.database },
        ]);
      });

      // Verify that selecting a collection updates selectedId (the fetch is driven
      // separately by the useLibrarySync effect that watches selectedId).
      it("setSelectedCollection should update selectedId", () => {
        const selected = collectionReducer(collectionInitialState, setSelectedCollection(3));
        expect(selected.selectedId).toBe(3);

        const cleared = collectionReducer(selected, setSelectedCollection(null));
        expect(cleared.selectedId).toBeNull();
      });

      // Verify that a stale fetch response for a shelf the user already left is ignored.
      it("fetchBooksInSelectedCollection ignores a stale response for a superseded shelf", async () => {
        const currentBooks = [createMockBookWithState({ id: 1, displayName: "current" })];
        const staleBooks = [createMockBookWithState({ id: 99, displayName: "stale" })];
        // The user is now on shelf 2 with its books already loaded.
        const preloadedState = {
          collection: {
            ...collectionInitialState,
            selectedId: 2,
            books: currentBooks,
          },
        };
        store = createTestStore(preloadedState);

        // A slow fetch for the previous shelf (1) finally resolves.
        vi.mocked(api.getBooksByCollection).mockResolvedValue(staleBooks);
        await store.dispatch(fetchBooksInSelectedCollection(1));

        // Shelf 2's books are preserved, not overwritten by the stale shelf-1 response.
        const state = store.getState().collection;
        expect(state.books).toEqual(currentBooks);
      });

      // Verify that book is added to collection and status is updated
      it("addBookToBookshelf should add a book", async () => {
        vi.mocked(api.registerBook).mockResolvedValue(10);

        await store.dispatch(addBookToBookshelf({ collectionId: 1, bookPath: "path/to/book.zip" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(api.registerBook).toHaveBeenCalledWith("path/to/book.zip");
        expect(api.addBookToCollection).toHaveBeenCalledWith(1, 10);
        // Opening would install the book, which closes the reader threads of the book on
        // screen. Registering must never do that.
        expect(api.openBook).not.toHaveBeenCalled();
      });

      // Verify that adding a book with no collection ID (null) only registers it
      it("addBookToBookshelf with collectionId: null should register book", async () => {
        vi.mocked(api.registerBook).mockResolvedValue(10);

        await store.dispatch(addBookToBookshelf({ collectionId: null, bookPath: "path" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(api.registerBook).toHaveBeenCalledWith("path");
        expect(api.addBookToCollection).not.toHaveBeenCalled();
      });

      // Verify error handling when book addition fails
      it("addBookToBookshelf should handle generic failure", async () => {
        vi.mocked(api.registerBook).mockRejectedValue(new Error());

        await store.dispatch(addBookToBookshelf({ collectionId: 1, bookPath: "path" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]);
      });

      // Verify CommandError handling when book addition fails
      it("addBookToBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "io fail");
        vi.mocked(api.registerBook).mockRejectedValue(mockError);

        await store.dispatch(addBookToBookshelf({ collectionId: 1, bookPath: "path" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.io },
        ]);
      });

      // Verify state update when removing a book from the collection
      it("deleteBookFromCollection should remove the book", async () => {
        vi.mocked(api.removeBookFromCollection).mockResolvedValue(null);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: 1 }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
      });

      // Verify that book is deleted from DB when removed with no collection ID (null)
      it("deleteBookFromCollection with collectionId: null should delete book from DB", async () => {
        vi.mocked(api.deleteBook).mockResolvedValue(null);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: null }));

        expect(api.deleteBook).toHaveBeenCalledWith(10);
      });

      // Verify error handling when book deletion fails
      it("deleteBookFromCollection should handle generic failure", async () => {
        vi.mocked(api.deleteBook).mockRejectedValue(new Error());

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: null }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]);
      });

      // Verify CommandError handling when book deletion fails
      it("deleteBookFromCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.database, "db error");
        vi.mocked(api.deleteBook).mockRejectedValue(mockError);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: null }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.database },
        ]);
      });

      // Verify state update on successful fetching of books in selected collection
      it("fetchBooksInSelectedCollection should update state correctly", async () => {
        const mockBooks = [createMockBookWithState({ id: 1, filePath: "b1.zip" })];
        vi.mocked(api.getBooksByCollection).mockResolvedValue(mockBooks);

        // The response only applies when its arg matches the current selection.
        store.dispatch(setSelectedCollection(1));
        await store.dispatch(fetchBooksInSelectedCollection(1));

        const state = store.getState().collection;
        expect(state.books).toEqual(mockBooks);
      });

      // Verify that all books are fetched when fetchBooksInSelectedCollection is called with null
      it("fetchBooksInSelectedCollection(null) should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 1 })];
        vi.mocked(api.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(fetchBooksInSelectedCollection(null));

        const state = store.getState().collection;
        expect(state.books).toEqual(mockBooks);
      });

      // Verify error handling when book fetching in selected collection fails
      it("fetchBooksInSelectedCollection should handle generic failure and clear books", async () => {
        vi.mocked(api.getAllBooksWithState).mockRejectedValue(new Error());

        // Pre-fill state to verify clearing
        const preloadedState = {
          collection: {
            ...collectionInitialState,
            books: [createMockBookWithState()],
          },
        };
        store = createTestStore(preloadedState);

        await store.dispatch(fetchBooksInSelectedCollection(null));

        const state = store.getState().collection;
        expect(state.status).toBe("failed");
        expect(state.books).toEqual([]);
      });

      // Verify CommandError handling when book fetching in selected collection fails
      it("fetchBooksInSelectedCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "io fail");
        vi.mocked(api.getAllBooksWithState).mockRejectedValue(mockError);

        await store.dispatch(fetchBooksInSelectedCollection(null));

        const state = store.getState().collection;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.io },
        ]);
      });

      it("a superseded book fetch fails silently", async () => {
        let failFetch: (reason: unknown) => void = () => {};
        vi.mocked(api.getAllBooksWithState)
          .mockReturnValueOnce(
            new Promise((_, reject) => {
              failFetch = reject;
            }),
          )
          .mockResolvedValueOnce([]);
        const first = store.dispatch(fetchBooksInSelectedCollection(null));
        await store.dispatch(fetchBooksInSelectedCollection(null));

        failFetch(new CommandError(ErrorCode.database, "locked"));
        await first;

        expect(store.getState().errorNotification.pending).toEqual([]);
      });

      // Selecting another collection starts no request, so only the selection tells.
      it("a book fetch for a collection the user left fails silently", async () => {
        let failFetch: (reason: unknown) => void = () => {};
        vi.mocked(api.getBooksByCollection).mockReturnValueOnce(
          new Promise((_, reject) => {
            failFetch = reject;
          }),
        );
        store.dispatch(setSelectedCollection(1));
        const first = store.dispatch(fetchBooksInSelectedCollection(1));
        store.dispatch(setSelectedCollection(2));

        failFetch(new CommandError(ErrorCode.database, "locked"));
        await first;

        expect(store.getState().collection.booksRequestId).toBe(first.requestId);
        expect(store.getState().errorNotification.pending).toEqual([]);
      });

      it("setCollectionsForBooks should save each book's collections", async () => {
        vi.mocked(api.setCollectionsForBook).mockResolvedValue(null);

        const result = await store.dispatch(
          setCollectionsForBooks([
            { bookId: 1, collectionIds: [10, 20] },
            { bookId: 2, collectionIds: [] },
          ]),
        );

        expect(setCollectionsForBooks.fulfilled.match(result)).toBe(true);
        expect(api.setCollectionsForBook).toHaveBeenCalledTimes(2);
        expect(api.setCollectionsForBook).toHaveBeenCalledWith(1, [10, 20]);
        expect(api.setCollectionsForBook).toHaveBeenCalledWith(2, []);
      });

      it("setCollectionsForBooks should report a failure without touching status", async () => {
        vi.mocked(api.setCollectionsForBook).mockRejectedValue(
          new CommandError(ErrorCode.database, "db fail"),
        );

        await store.dispatch(setCollectionsForBooks([{ bookId: 1, collectionIds: [10] }]));

        const state = store.getState().collection;
        // A mutation never flips the grid into its loading state.
        expect(state.status).toBe("idle");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.database },
        ]);
      });
    });
  });
});

describe("TagReducer", () => {
  let store: AppStore;

  const tagInitialState = {
    tags: [] as Tag[],
    selectedId: null as number | null,
    status: "idle" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is set correctly
  it("should handle initial state", () => {
    expect(tagReducer(undefined, { type: "unknown" })).toEqual(tagInitialState);
  });

  // Verify that selected tag ID is set correctly
  it("should handle setSelectedTag", () => {
    const nextState = tagReducer(tagInitialState, setSelectedTag(1));
    expect(nextState.selectedId).toBe(1);
  });

  describe("Tag Thunks", () => {
    // Verify state update on successful tag fetching
    it("fetchTags should update state with fetched tags on success", async () => {
      const mockTags = [createMockTag({ id: 1, name: "T1" })];
      vi.mocked(api.getAllTags).mockResolvedValue(mockTags);

      await store.dispatch(fetchTags());

      const state = store.getState().tag;
      expect(state.status).toBe("succeeded");
      expect(state.tags).toEqual(mockTags);
    });

    // Verify error handling when tag fetching fails
    it("fetchTags should handle generic failure and clear tags", async () => {
      vi.mocked(api.getAllTags).mockRejectedValue(new Error());

      // Pre-fill state to verify clearing
      const preloadedState = {
        tag: { ...tagInitialState, tags: [createMockTag()] },
      };
      store = createTestStore(preloadedState);

      await store.dispatch(fetchTags());

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.tags).toEqual([]);
    });

    // Verify CommandError handling when tag fetching fails
    it("fetchTags should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.database, "db error");
      vi.mocked(api.getAllTags).mockRejectedValue(mockError);

      await store.dispatch(fetchTags());

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "tag", code: ErrorCode.database },
      ]);
    });

    // Verify state update on successful tag creation
    it("addTag should update status to succeeded on success", async () => {
      const mockTag = createMockTag({ id: 1, name: "New Tag" });
      vi.mocked(api.createTag).mockResolvedValue(mockTag);

      await store.dispatch(addTag({ name: "New Tag", colorCode: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("succeeded");
    });

    // Verify error handling when tag creation fails
    it("addTag should handle generic failure", async () => {
      vi.mocked(api.createTag).mockRejectedValue(new Error());

      await store.dispatch(addTag({ name: "New Tag", colorCode: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "tag", code: ErrorCode.other },
      ]);
    });

    // Verify CommandError handling when tag creation fails
    it("addTag should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.io, "io fail");
      vi.mocked(api.createTag).mockRejectedValue(mockError);

      await store.dispatch(addTag({ name: "New Tag", colorCode: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "tag", code: ErrorCode.io },
      ]);
    });

    // Verify that selectedId is reset if the selected tag is deleted
    it("removeTag should update selectedId if deleted", async () => {
      const preloadedState = {
        tag: structuredClone({ ...tagInitialState, selectedId: 1 }),
      };

      store = createTestStore(preloadedState);
      vi.mocked(api.deleteTag).mockResolvedValue(null);
      vi.mocked(api.getAllTags).mockResolvedValue([]);

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.selectedId).toBeNull();
    });

    // Verify that selectedId is maintained if a different tag is deleted
    it("removeTag should not change selectedId if different ID deleted", async () => {
      const preloadedState = {
        tag: structuredClone({ ...tagInitialState, selectedId: 2 }),
      };

      store = createTestStore(preloadedState);
      vi.mocked(api.deleteTag).mockResolvedValue(null);

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.selectedId).toBe(2);
    });

    // Verify error handling when tag removal fails
    it("removeTag should handle generic failure", async () => {
      vi.mocked(api.deleteTag).mockRejectedValue(new Error());

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "tag", code: ErrorCode.other },
      ]);
    });

    // Verify CommandError handling when tag removal fails
    it("removeTag should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.database, "db fail");
      vi.mocked(api.deleteTag).mockRejectedValue(mockError);

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "tag", code: ErrorCode.database },
      ]);
    });

    it("updateBooksTags should save each book's own tag set", async () => {
      vi.mocked(api.setTagsForBook).mockResolvedValue(null);

      const result = await store.dispatch(
        updateBooksTags([
          { bookId: 1, tagIds: [7] },
          { bookId: 2, tagIds: [3, 7] },
        ]),
      );

      expect(updateBooksTags.fulfilled.match(result)).toBe(true);
      expect(api.setTagsForBook).toHaveBeenCalledWith(1, [7]);
      expect(api.setTagsForBook).toHaveBeenCalledWith(2, [3, 7]);
    });

    it("updateBooksTags should report a failure without touching status", async () => {
      vi.mocked(api.setTagsForBook).mockRejectedValue(
        new CommandError(ErrorCode.database, "db fail"),
      );

      await store.dispatch(updateBooksTags([{ bookId: 1, tagIds: [7] }]));

      const state = store.getState().tag;
      expect(state.status).toBe("idle");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "tag", code: ErrorCode.database },
      ]);
    });
  });
});

describe("SeriesReducer", () => {
  let store: AppStore;

  const seriesInitialState = {
    series: [] as Series[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    status: "idle" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is set correctly
  it("should handle initial state", () => {
    expect(seriesReducer(undefined, { type: "unknown" })).toEqual(seriesInitialState);
  });

  // Verify that selected series ID is set correctly
  it("should handle setSelectedSeriesId", () => {
    const nextState = seriesReducer(seriesInitialState, setSelectedSeriesId(1));
    expect(nextState.selectedId).toBe(1);
  });

  // Verify that choosing a collection, even the one already shown, closes the open series
  it.each([
    [2, 5],
    [5, 5],
    [null, 5],
  ])("setSelectedCollection(%s) from %s should close the open series", (next, current) => {
    const state = createBasePreloadedState();
    state.collection.selectedId = current;
    state.series.selectedId = 10;
    store = createTestStore(state);

    store.dispatch(setSelectedCollection(next));

    expect(store.getState().series.selectedId).toBeNull();
  });

  // Verify that a tag is a filter inside the series, not a new place
  it("setSelectedTag should keep the open series", () => {
    const state = createBasePreloadedState();
    state.series.selectedId = 10;
    store = createTestStore(state);

    store.dispatch(setSelectedTag(3));

    expect(store.getState().series.selectedId).toBe(10);
  });

  // Verify that deleting the selected collection closes the open series along with it
  it("removeCollection of the selected collection should close the open series", async () => {
    const state = createBasePreloadedState();
    state.collection.selectedId = 1;
    state.series.selectedId = 10;
    store = createTestStore(state);
    vi.mocked(api.deleteCollection).mockResolvedValue(null);

    await store.dispatch(removeCollection(1));

    expect(store.getState().collection.selectedId).toBeNull();
    expect(store.getState().series.selectedId).toBeNull();
  });

  // Verify that deleting another collection leaves the open series alone
  it("removeCollection of another collection should keep the open series", async () => {
    const state = createBasePreloadedState();
    state.collection.selectedId = 2;
    state.series.selectedId = 10;
    store = createTestStore(state);
    vi.mocked(api.deleteCollection).mockResolvedValue(null);

    await store.dispatch(removeCollection(1));

    expect(store.getState().collection.selectedId).toBe(2);
    expect(store.getState().series.selectedId).toBe(10);
  });

  describe("Series Thunks", () => {
    it("updateSeriesOrdersThunk should update order", async () => {
      vi.mocked(api.setSeriesOrder).mockResolvedValue(null);

      await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));

      expect(api.setSeriesOrder).toHaveBeenCalledWith([1, 2, 3]);
    });

    // The backend's books-changed event refreshes the bookshelf; a second fetch is waste
    it("updateSeriesOrdersThunk leaves the refetch to the books-changed event", async () => {
      vi.mocked(api.setSeriesOrder).mockResolvedValue(null);

      await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));

      expect(api.getAllBooksWithState).not.toHaveBeenCalled();
      expect(api.getBooksByCollection).not.toHaveBeenCalled();
    });

    it("updateSeriesOrdersThunk should handle generic failure", async () => {
      vi.mocked(api.setSeriesOrder).mockRejectedValue(new Error());

      const result = await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));
      expect(result.payload).toMatchObject({ code: ErrorCode.other });
    });

    it("reports a failed series reorder", async () => {
      vi.mocked(api.setSeriesOrder).mockRejectedValue(
        new CommandError(ErrorCode.database, "locked"),
      );

      await store.dispatch(updateSeriesOrdersThunk([1, 2]));

      expect(store.getState().errorNotification.pending).toEqual([
        { context: "series", code: ErrorCode.database },
      ]);
    });

    it("addSeries should create the series, refetch the list, and return the new id", async () => {
      const created: Series = { id: 3, name: "New", createdAt: "2026-03-01T15:30:00Z" };
      vi.mocked(api.createSeries).mockResolvedValue(created);
      vi.mocked(api.getAllSeries).mockResolvedValue([created]);

      const result = await store.dispatch(addSeries("New"));

      expect(api.createSeries).toHaveBeenCalledWith("New");
      expect(result.payload).toBe(3);
      expect(store.getState().series.series).toEqual([created]);
    });

    it("addSeries should report a failure without touching status", async () => {
      vi.mocked(api.createSeries).mockRejectedValue(
        new CommandError(ErrorCode.database, "db fail"),
      );

      await store.dispatch(addSeries("New"));

      const state = store.getState().series;
      expect(state.status).toBe("idle");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "series", code: ErrorCode.database },
      ]);
      expect(api.getAllSeries).not.toHaveBeenCalled();
    });

    it("removeSeries should delete the series", async () => {
      vi.mocked(api.deleteSeries).mockResolvedValue(null);

      const result = await store.dispatch(removeSeries(5));

      expect(removeSeries.fulfilled.match(result)).toBe(true);
      expect(api.deleteSeries).toHaveBeenCalledWith(5);
    });

    it("removeSeries should report a failure without touching status", async () => {
      vi.mocked(api.deleteSeries).mockRejectedValue(new Error());

      await store.dispatch(removeSeries(5));

      const state = store.getState().series;
      expect(state.status).toBe("idle");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "series", code: ErrorCode.other },
      ]);
    });

    it("updateBooksSeries should assign the series to every book", async () => {
      vi.mocked(api.setSeriesForBook).mockResolvedValue(null);

      const result = await store.dispatch(updateBooksSeries({ bookIds: [1, 2], seriesId: null }));

      expect(updateBooksSeries.fulfilled.match(result)).toBe(true);
      expect(api.setSeriesForBook).toHaveBeenCalledWith(1, null);
      expect(api.setSeriesForBook).toHaveBeenCalledWith(2, null);
    });

    it("updateBooksSeries should report a failure without touching status", async () => {
      vi.mocked(api.setSeriesForBook).mockRejectedValue(
        new CommandError(ErrorCode.database, "db fail"),
      );

      await store.dispatch(updateBooksSeries({ bookIds: [1], seriesId: 2 }));

      const state = store.getState().series;
      expect(state.status).toBe("idle");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "series", code: ErrorCode.database },
      ]);
    });

    // Verify state update on successful series fetching
    it("fetchSeries should update state with fetched series on success", async () => {
      const mockSeries: Series[] = [{ id: 1, name: "Series 1", createdAt: "2026-03-01T15:30:00Z" }];
      vi.mocked(api.getAllSeries).mockResolvedValue(mockSeries);

      await store.dispatch(fetchSeries());

      const state = store.getState().series;
      expect(state.status).toBe("succeeded");
      expect(state.series).toEqual(mockSeries);
    });

    // Verify error handling when series fetching fails
    it("fetchSeries should handle generic failure and clear series", async () => {
      vi.mocked(api.getAllSeries).mockRejectedValue(new Error());

      // Pre-fill state to verify clearing
      const preloadedState = {
        series: {
          ...seriesInitialState,
          series: [{ id: 1, name: "S1", createdAt: "" }],
        },
      };
      store = createTestStore(preloadedState);

      await store.dispatch(fetchSeries());

      const state = store.getState().series;
      expect(state.status).toBe("failed");
      expect(state.series).toEqual([]);
    });

    // Verify CommandError handling when series fetching fails
    it("fetchSeries should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.database, "db fail");
      vi.mocked(api.getAllSeries).mockRejectedValue(mockError);

      await store.dispatch(fetchSeries());

      const state = store.getState().series;
      expect(state.status).toBe("failed");
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "series", code: ErrorCode.database },
      ]);
    });
  });
});
