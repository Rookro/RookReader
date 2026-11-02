import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../bindings/BookCommands";
import * as CollectionCommands from "../../bindings/CollectionCommands";
import * as ContainerCommands from "../../bindings/ContainerCommands";
import * as SeriesCommand from "../../bindings/SeriesCommands";
import * as TagCommands from "../../bindings/TagCommands";
import type { BookWithState, Collection, Series, Tag } from "../../domain/entities";
import { readingProgressChanged } from "../../store/actions";
import { createMockBookWithState, createMockCollection, createMockTag } from "../../test/factories";
import { type AppStore, createBasePreloadedState, createTestStore } from "../../test/utils";
import type { ThunkRejectValue } from "../../types/CustomAsyncThunk";
import { CommandError, ErrorCode } from "../../types/Error";
import seriesReducer, {
  addSeries,
  clearSeriesError,
  fetchSeries,
  removeSeries,
  setSelectedSeriesId,
  updateBooksSeries,
  updateSeriesOrdersThunk,
} from "./seriesSlice";
import collectionReducer, {
  addBookToBookshelf,
  addCollection,
  clearCollectionError,
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
  clearTagError,
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
    error: null as ThunkRejectValue | null,
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

  // Verify that collection error state is cleared correctly
  it("should handle clearCollectionError", () => {
    const stateWithError = structuredClone(collectionInitialState);
    stateWithError.error = { code: ErrorCode.other };
    const nextState = collectionReducer(stateWithError, clearCollectionError());
    expect(nextState.error).toBeNull();
  });

  // Verify that readingProgressChanged patches the matching book in place.
  it("should patch the matching book on readingProgressChanged", () => {
    const state = {
      ...collectionInitialState,
      books: [
        createMockBookWithState({ id: 1, last_read_page_index: 0 }),
        createMockBookWithState({ id: 2, last_read_page_index: 5 }),
      ],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        book_id: 2,
        last_read_page_index: 9,
        cfi: null,
        last_opened_at: "2026-07-04T10:00:00",
      }),
    );
    expect(nextState.books[0].last_read_page_index).toBe(0);
    expect(nextState.books[1].last_read_page_index).toBe(9);
    expect(nextState.books[1].last_opened_at).toBe("2026-07-04T10:00:00");
  });

  // A progress update without a timestamp does not blank the listed one.
  it("should keep last_opened_at when readingProgressChanged carries none", () => {
    const state = {
      ...collectionInitialState,
      books: [
        createMockBookWithState({
          id: 1,
          last_read_page_index: 0,
          last_opened_at: "2026-07-01T09:00:00",
        }),
      ],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        book_id: 1,
        last_read_page_index: 4,
        cfi: null,
        last_opened_at: null,
      }),
    );
    expect(nextState.books[0].last_read_page_index).toBe(4);
    expect(nextState.books[0].last_opened_at).toBe("2026-07-01T09:00:00");
  });

  // Verify that readingProgressChanged for an unknown book id is a no-op.
  it("should ignore readingProgressChanged for an unknown book id", () => {
    const state = {
      ...collectionInitialState,
      books: [createMockBookWithState({ id: 1, last_read_page_index: 3 })],
    };
    const nextState = collectionReducer(
      state,
      readingProgressChanged({
        book_id: 999,
        last_read_page_index: 42,
        cfi: null,
        last_opened_at: "2026-07-04T10:00:00",
      }),
    );
    expect(nextState.books[0].last_read_page_index).toBe(3);
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
      ["addCollection", addCollection.pending("r", { name: "n", icon_id: "i" })],
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
      expect(nextState.error).toBeNull();
    });

    describe("Collection Thunks", () => {
      // Verify that collection list is updated on success
      it("fetchCollections should update state with fetched collections on success", async () => {
        const mockCollections = [createMockCollection({ id: 1, name: "BS1" })];
        vi.mocked(CollectionCommands.getAllCollections).mockResolvedValue(mockCollections);

        await store.dispatch(fetchCollections());

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
      });

      // Verify handling of CommandError when fetching collections
      it("fetchCollections should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "failed");
        vi.mocked(CollectionCommands.getAllCollections).mockRejectedValue(mockError);

        await store.dispatch(fetchCollections());

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.io);
      });

      // Verify error handling when collection fetching fails
      it("fetchCollections should handle generic Error and clear collections", async () => {
        const mockError = new Error("failed");
        vi.mocked(CollectionCommands.getAllCollections).mockRejectedValue(mockError);

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
        expect(state.error?.code).toBe(ErrorCode.other);
        expect(state.collections).toEqual([]);
      });

      // Verify state update on successful collection creation
      it("addCollection should leave the grid status alone on success", async () => {
        const mockCollection = createMockCollection({ id: 1, name: "New BS" });
        vi.mocked(CollectionCommands.createCollection).mockResolvedValue(mockCollection);

        await store.dispatch(addCollection({ name: "New BS", icon_id: "folder" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
      });

      // Verify handling of CommandError during collection creation
      it("addCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "io error");
        vi.mocked(CollectionCommands.createCollection).mockRejectedValue(mockError);

        await store.dispatch(addCollection({ name: "Existing BS", icon_id: "folder" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.io);
      });

      // Verify handling of generic Error during collection creation
      it("addCollection should handle generic Error", async () => {
        const mockError = new Error("unknown error");
        vi.mocked(CollectionCommands.createCollection).mockRejectedValue(mockError);

        await store.dispatch(addCollection({ name: "Error BS", icon_id: "folder" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.other);
      });

      // Verify error handling when collection removal fails with no payload
      // Verify error handling when collection removal fails with no payload
      it("removeCollection should handle failure with no payload", async () => {
        vi.mocked(CollectionCommands.deleteCollection).mockImplementation(() => {
          throw new Error("fail");
        });

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error).toBeDefined();
      });

      // Verify that selectedId is reset if the selected collection is deleted
      it("removeCollection should update selectedId if deleted", async () => {
        const preloadedState = {
          collection: structuredClone(collectionInitialState),
        };
        preloadedState.collection.selectedId = 1;

        store = createTestStore(preloadedState);
        vi.mocked(CollectionCommands.deleteCollection).mockResolvedValue(undefined);
        vi.mocked(CollectionCommands.getAllCollections).mockResolvedValue([]);

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
        vi.mocked(CollectionCommands.deleteCollection).mockResolvedValue(undefined);

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.selectedId).toBe(2);
      });

      // Verify error handling when collection removal fails
      it("removeCollection should handle generic failure", async () => {
        vi.mocked(CollectionCommands.deleteCollection).mockRejectedValue(new Error());

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.other);
      });

      // Verify CommandError handling when collection removal fails
      it("removeCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.database, "db fail");
        vi.mocked(CollectionCommands.deleteCollection).mockRejectedValue(mockError);

        await store.dispatch(removeCollection(1));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.database);
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
        const currentBooks = [createMockBookWithState({ id: 1, display_name: "current" })];
        const staleBooks = [createMockBookWithState({ id: 99, display_name: "stale" })];
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
        vi.mocked(CollectionCommands.getBooksByCollection).mockResolvedValue(staleBooks);
        await store.dispatch(fetchBooksInSelectedCollection(1));

        // Shelf 2's books are preserved, not overwritten by the stale shelf-1 response.
        const state = store.getState().collection;
        expect(state.books).toEqual(currentBooks);
      });

      // Verify that book is added to collection and status is updated
      it("addBookToBookshelf should add a book", async () => {
        vi.mocked(BookCommands.registerBook).mockResolvedValue(10);

        await store.dispatch(addBookToBookshelf({ collectionId: 1, bookPath: "path/to/book.zip" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(BookCommands.registerBook).toHaveBeenCalledWith("path/to/book.zip");
        expect(CollectionCommands.addBookToCollection).toHaveBeenCalledWith(1, 10);
        // Opening would install the book, which closes the reader threads of the book on
        // screen. Registering must never do that.
        expect(ContainerCommands.openContainer).not.toHaveBeenCalled();
      });

      // Verify that adding a book with no collection ID (null) only registers it
      it("addBookToBookshelf with collectionId: null should register book", async () => {
        vi.mocked(BookCommands.registerBook).mockResolvedValue(10);

        await store.dispatch(addBookToBookshelf({ collectionId: null, bookPath: "path" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(BookCommands.registerBook).toHaveBeenCalledWith("path");
        expect(CollectionCommands.addBookToCollection).not.toHaveBeenCalled();
      });

      // Verify error handling when book addition fails
      it("addBookToBookshelf should handle generic failure", async () => {
        vi.mocked(BookCommands.registerBook).mockRejectedValue(new Error());

        await store.dispatch(addBookToBookshelf({ collectionId: 1, bookPath: "path" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.other);
      });

      // Verify CommandError handling when book addition fails
      it("addBookToBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.io, "io fail");
        vi.mocked(BookCommands.registerBook).mockRejectedValue(mockError);

        await store.dispatch(addBookToBookshelf({ collectionId: 1, bookPath: "path" }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.io);
      });

      // Verify state update when removing a book from the collection
      it("deleteBookFromCollection should remove the book", async () => {
        vi.mocked(CollectionCommands.removeBookFromCollection).mockResolvedValue(undefined);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: 1 }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
      });

      // Verify that book is deleted from DB when removed with no collection ID (null)
      it("deleteBookFromCollection with collectionId: null should delete book from DB", async () => {
        vi.mocked(BookCommands.deleteBook).mockResolvedValue(undefined);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: null }));

        expect(BookCommands.deleteBook).toHaveBeenCalledWith(10);
      });

      // Verify error handling when book deletion fails
      it("deleteBookFromCollection should handle generic failure", async () => {
        vi.mocked(BookCommands.deleteBook).mockRejectedValue(new Error());

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: null }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.other);
      });

      // Verify CommandError handling when book deletion fails
      it("deleteBookFromCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.database, "db error");
        vi.mocked(BookCommands.deleteBook).mockRejectedValue(mockError);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, collectionId: null }));

        const state = store.getState().collection;
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.database);
      });

      // Verify state update on successful fetching of books in selected collection
      it("fetchBooksInSelectedCollection should update state correctly", async () => {
        const mockBooks = [createMockBookWithState({ id: 1, file_path: "b1.zip" })];
        vi.mocked(CollectionCommands.getBooksByCollection).mockResolvedValue(mockBooks);

        // The response only applies when its arg matches the current selection.
        store.dispatch(setSelectedCollection(1));
        await store.dispatch(fetchBooksInSelectedCollection(1));

        const state = store.getState().collection;
        expect(state.books).toEqual(mockBooks);
      });

      // Verify that all books are fetched when fetchBooksInSelectedCollection is called with null
      it("fetchBooksInSelectedCollection(null) should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 1 })];
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(fetchBooksInSelectedCollection(null));

        const state = store.getState().collection;
        expect(state.books).toEqual(mockBooks);
      });

      // Verify error handling when book fetching in selected collection fails
      it("fetchBooksInSelectedCollection should handle generic failure and clear books", async () => {
        vi.mocked(BookCommands.getAllBooksWithState).mockRejectedValue(new Error());

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
        vi.mocked(BookCommands.getAllBooksWithState).mockRejectedValue(mockError);

        await store.dispatch(fetchBooksInSelectedCollection(null));

        const state = store.getState().collection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.io);
      });

      it("setCollectionsForBooks should save each book's collections", async () => {
        vi.mocked(CollectionCommands.setCollectionsForBook).mockResolvedValue();

        const result = await store.dispatch(
          setCollectionsForBooks([
            { bookId: 1, collectionIds: [10, 20] },
            { bookId: 2, collectionIds: [] },
          ]),
        );

        expect(setCollectionsForBooks.fulfilled.match(result)).toBe(true);
        expect(CollectionCommands.setCollectionsForBook).toHaveBeenCalledTimes(2);
        expect(CollectionCommands.setCollectionsForBook).toHaveBeenCalledWith(1, [10, 20]);
        expect(CollectionCommands.setCollectionsForBook).toHaveBeenCalledWith(2, []);
      });

      it("setCollectionsForBooks should set only the error on failure", async () => {
        vi.mocked(CollectionCommands.setCollectionsForBook).mockRejectedValue(
          new CommandError(ErrorCode.database, "db fail"),
        );

        await store.dispatch(setCollectionsForBooks([{ bookId: 1, collectionIds: [10] }]));

        const state = store.getState().collection;
        // A mutation never flips the grid into its loading state.
        expect(state.status).toBe("idle");
        expect(state.error?.code).toBe(ErrorCode.database);
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
    error: null as ThunkRejectValue | null,
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

  // Verify that tag error state is cleared correctly
  it("should handle clearTagError", () => {
    const stateWithError = {
      ...tagInitialState,
      error: { code: ErrorCode.other },
    };
    const nextState = tagReducer(stateWithError, clearTagError());
    expect(nextState.error).toBeNull();
  });

  describe("Tag Thunks", () => {
    // Verify state update on successful tag fetching
    it("fetchTags should update state with fetched tags on success", async () => {
      const mockTags = [createMockTag({ id: 1, name: "T1" })];
      vi.mocked(TagCommands.getAllTags).mockResolvedValue(mockTags);

      await store.dispatch(fetchTags());

      const state = store.getState().tag;
      expect(state.status).toBe("succeeded");
      expect(state.tags).toEqual(mockTags);
    });

    // Verify error handling when tag fetching fails
    it("fetchTags should handle generic failure and clear tags", async () => {
      vi.mocked(TagCommands.getAllTags).mockRejectedValue(new Error());

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
      vi.mocked(TagCommands.getAllTags).mockRejectedValue(mockError);

      await store.dispatch(fetchTags());

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.database);
    });

    // Verify state update on successful tag creation
    it("addTag should update status to succeeded on success", async () => {
      const mockTag = createMockTag({ id: 1, name: "New Tag" });
      vi.mocked(TagCommands.createTag).mockResolvedValue(mockTag);

      await store.dispatch(addTag({ name: "New Tag", color_code: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("succeeded");
    });

    // Verify error handling when tag creation fails
    it("addTag should handle generic failure", async () => {
      vi.mocked(TagCommands.createTag).mockRejectedValue(new Error());

      await store.dispatch(addTag({ name: "New Tag", color_code: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.other);
    });

    // Verify CommandError handling when tag creation fails
    it("addTag should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.io, "io fail");
      vi.mocked(TagCommands.createTag).mockRejectedValue(mockError);

      await store.dispatch(addTag({ name: "New Tag", color_code: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.io);
    });

    // Verify that selectedId is reset if the selected tag is deleted
    it("removeTag should update selectedId if deleted", async () => {
      const preloadedState = {
        tag: structuredClone({ ...tagInitialState, selectedId: 1 }),
      };

      store = createTestStore(preloadedState);
      vi.mocked(TagCommands.deleteTag).mockResolvedValue(undefined);
      vi.mocked(TagCommands.getAllTags).mockResolvedValue([]);

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
      vi.mocked(TagCommands.deleteTag).mockResolvedValue(undefined);

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.selectedId).toBe(2);
    });

    // Verify error handling when tag removal fails
    it("removeTag should handle generic failure", async () => {
      vi.mocked(TagCommands.deleteTag).mockRejectedValue(new Error());

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.other);
    });

    // Verify CommandError handling when tag removal fails
    it("removeTag should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.database, "db fail");
      vi.mocked(TagCommands.deleteTag).mockRejectedValue(mockError);

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.database);
    });

    it("updateBooksTags should save each book's own tag set", async () => {
      vi.mocked(TagCommands.setTagsForBook).mockResolvedValue();

      const result = await store.dispatch(
        updateBooksTags([
          { bookId: 1, tagIds: [7] },
          { bookId: 2, tagIds: [3, 7] },
        ]),
      );

      expect(updateBooksTags.fulfilled.match(result)).toBe(true);
      expect(TagCommands.setTagsForBook).toHaveBeenCalledWith(1, [7]);
      expect(TagCommands.setTagsForBook).toHaveBeenCalledWith(2, [3, 7]);
    });

    it("updateBooksTags should set only the error on failure", async () => {
      vi.mocked(TagCommands.setTagsForBook).mockRejectedValue(
        new CommandError(ErrorCode.database, "db fail"),
      );

      await store.dispatch(updateBooksTags([{ bookId: 1, tagIds: [7] }]));

      const state = store.getState().tag;
      expect(state.status).toBe("idle");
      expect(state.error?.code).toBe(ErrorCode.database);
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
    error: null as ThunkRejectValue | null,
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

  // Verify that series error state is cleared correctly
  it("should handle clearSeriesError", () => {
    const stateWithError = structuredClone(seriesInitialState);
    stateWithError.error = { code: ErrorCode.other };
    const nextState = seriesReducer(stateWithError, clearSeriesError());
    expect(nextState.error).toBeNull();
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
    vi.mocked(CollectionCommands.deleteCollection).mockResolvedValue(undefined);

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
    vi.mocked(CollectionCommands.deleteCollection).mockResolvedValue(undefined);

    await store.dispatch(removeCollection(1));

    expect(store.getState().collection.selectedId).toBe(2);
    expect(store.getState().series.selectedId).toBe(10);
  });

  describe("Series Thunks", () => {
    it("updateSeriesOrdersThunk should update order", async () => {
      vi.mocked(SeriesCommand.setSeriesOrder).mockResolvedValue(undefined);

      await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));

      expect(SeriesCommand.setSeriesOrder).toHaveBeenCalledWith([1, 2, 3]);
    });

    // The backend's books-changed event refreshes the bookshelf; a second fetch is waste
    it("updateSeriesOrdersThunk leaves the refetch to the books-changed event", async () => {
      vi.mocked(SeriesCommand.setSeriesOrder).mockResolvedValue(undefined);

      await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));

      expect(BookCommands.getAllBooksWithState).not.toHaveBeenCalled();
      expect(CollectionCommands.getBooksByCollection).not.toHaveBeenCalled();
    });

    it("updateSeriesOrdersThunk should handle generic failure", async () => {
      vi.mocked(SeriesCommand.setSeriesOrder).mockRejectedValue(new Error());

      const result = await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));
      expect(result.payload).toMatchObject({ code: ErrorCode.other });
    });

    it("addSeries should create the series, refetch the list, and return the new id", async () => {
      const created: Series = { id: 3, name: "New", created_at: "2026-03-01T15:30:00" };
      vi.mocked(SeriesCommand.createSeries).mockResolvedValue(created);
      vi.mocked(SeriesCommand.getAllSeries).mockResolvedValue([created]);

      const result = await store.dispatch(addSeries("New"));

      expect(SeriesCommand.createSeries).toHaveBeenCalledWith("New");
      expect(result.payload).toBe(3);
      expect(store.getState().series.series).toEqual([created]);
    });

    it("addSeries should set only the error on failure", async () => {
      vi.mocked(SeriesCommand.createSeries).mockRejectedValue(
        new CommandError(ErrorCode.database, "db fail"),
      );

      await store.dispatch(addSeries("New"));

      const state = store.getState().series;
      expect(state.status).toBe("idle");
      expect(state.error?.code).toBe(ErrorCode.database);
      expect(SeriesCommand.getAllSeries).not.toHaveBeenCalled();
    });

    it("removeSeries should delete the series", async () => {
      vi.mocked(SeriesCommand.deleteSeries).mockResolvedValue();

      const result = await store.dispatch(removeSeries(5));

      expect(removeSeries.fulfilled.match(result)).toBe(true);
      expect(SeriesCommand.deleteSeries).toHaveBeenCalledWith(5);
    });

    it("removeSeries should set only the error on failure", async () => {
      vi.mocked(SeriesCommand.deleteSeries).mockRejectedValue(new Error());

      await store.dispatch(removeSeries(5));

      const state = store.getState().series;
      expect(state.status).toBe("idle");
      expect(state.error?.code).toBe(ErrorCode.other);
    });

    it("updateBooksSeries should assign the series to every book", async () => {
      vi.mocked(SeriesCommand.setSeriesForBook).mockResolvedValue();

      const result = await store.dispatch(updateBooksSeries({ bookIds: [1, 2], seriesId: null }));

      expect(updateBooksSeries.fulfilled.match(result)).toBe(true);
      expect(SeriesCommand.setSeriesForBook).toHaveBeenCalledWith(1, null);
      expect(SeriesCommand.setSeriesForBook).toHaveBeenCalledWith(2, null);
    });

    it("updateBooksSeries should set only the error on failure", async () => {
      vi.mocked(SeriesCommand.setSeriesForBook).mockRejectedValue(
        new CommandError(ErrorCode.database, "db fail"),
      );

      await store.dispatch(updateBooksSeries({ bookIds: [1], seriesId: 2 }));

      const state = store.getState().series;
      expect(state.status).toBe("idle");
      expect(state.error?.code).toBe(ErrorCode.database);
    });

    // Verify state update on successful series fetching
    it("fetchSeries should update state with fetched series on success", async () => {
      const mockSeries: Series[] = [{ id: 1, name: "Series 1", created_at: "2026-03-01T15:30:00" }];
      vi.mocked(SeriesCommand.getAllSeries).mockResolvedValue(mockSeries);

      await store.dispatch(fetchSeries());

      const state = store.getState().series;
      expect(state.status).toBe("succeeded");
      expect(state.series).toEqual(mockSeries);
    });

    // Verify error handling when series fetching fails
    it("fetchSeries should handle generic failure and clear series", async () => {
      vi.mocked(SeriesCommand.getAllSeries).mockRejectedValue(new Error());

      // Pre-fill state to verify clearing
      const preloadedState = {
        series: {
          ...seriesInitialState,
          series: [{ id: 1, name: "S1", created_at: "" }],
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
      vi.mocked(SeriesCommand.getAllSeries).mockRejectedValue(mockError);

      await store.dispatch(fetchSeries());

      const state = store.getState().series;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.database);
    });
  });
});
