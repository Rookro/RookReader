import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../bindings/BookCommands";
import * as BookshelfCommand from "../../bindings/BookshelfCommands";
import * as ContainerCommands from "../../bindings/ContainerCommands";
import * as SeriesCommand from "../../bindings/SeriesCommands";
import * as TagCommands from "../../bindings/TagCommands";
import type { BookWithState } from "../../domain/book/schema";
import type { Bookshelf } from "../../domain/bookshelf/schema";
import type { Series } from "../../domain/series/schema";
import type { Tag } from "../../domain/tag/schema";
import { createMockBookshelf, createMockBookWithState, createMockTag } from "../../test/factories";
import { type AppStore, createTestStore } from "../../test/utils";
import { CommandError, ErrorCode } from "../../types/Error";
import seriesReducer, {
  clearSeriesError,
  fetchSeries,
  setEditSeriesOrderDialogState,
  setSelectedSeriesId,
  updateSeriesOrdersThunk,
} from "./seriesSlice";
import bookCollectionReducer, {
  addBookshelf,
  addBookToBookshelf,
  bookshelfAdded,
  changeBookshelf,
  clearBookshelfError,
  deleteBookFromCollection,
  fetchBookshelves,
  fetchBooksInSelectedBookshelf,
  removeBookshelf,
  setSearchText,
} from "./slice";
import tagReducer, {
  addTag,
  clearTagError,
  fetchTags,
  removeTag,
  setSelectedTag,
} from "./tagSlice";

describe("BookCollectionReducer", () => {
  let store: AppStore;

  const bookCollectionInitialState = {
    searchText: "",
    bookshelves: [] as Bookshelf[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    status: "idle" as const,
    error: null as { code: ErrorCode; message?: string } | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is set correctly
  it("should handle initial state", () => {
    expect(bookCollectionReducer(undefined, { type: "unknown" })).toEqual(
      bookCollectionInitialState,
    );
  });

  // Verify that search text is set correctly
  it("should handle setSearchText", () => {
    const nextState = bookCollectionReducer(bookCollectionInitialState, setSearchText("query"));
    expect(nextState.searchText).toBe("query");
  });

  // Verify that state is updated when a bookshelf is added
  it("should handle bookshelfAdded", () => {
    const newBookshelf = createMockBookshelf({ id: 1, name: "New" });
    const nextState = bookCollectionReducer(
      bookCollectionInitialState,
      bookshelfAdded(newBookshelf),
    );
    expect(nextState.bookshelves).toContainEqual(newBookshelf);
  });

  // Verify that bookshelf error state is cleared correctly
  it("should handle clearBookshelfError", () => {
    const stateWithError = structuredClone(bookCollectionInitialState);
    stateWithError.error = { code: ErrorCode.OTHER_ERROR };
    const nextState = bookCollectionReducer(stateWithError, clearBookshelfError());
    expect(nextState.error).toBeNull();
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify state update when rejected actions have undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const action = { type: addBookshelf.rejected.type, payload: undefined };
      const nextState = bookCollectionReducer(bookCollectionInitialState, action);
      expect(nextState.status).toBe("failed");
      expect(nextState.error).toBeNull();
    });

    describe("Bookshelf Thunks", () => {
      // Verify that bookshelf list is updated on success
      it("fetchBookshelves should update state with fetched bookshelves on success", async () => {
        const mockBookshelves = [createMockBookshelf({ id: 1, name: "BS1" })];
        vi.mocked(BookshelfCommand.getAllBookshelves).mockResolvedValue(mockBookshelves);

        await store.dispatch(fetchBookshelves());

        const state = store.getState().bookCollection;
        expect(state.status).toBe("succeeded");
      });

      // Verify handling of CommandError when fetching bookshelves
      it("fetchBookshelves should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "failed");
        vi.mocked(BookshelfCommand.getAllBookshelves).mockRejectedValue(mockError);

        await store.dispatch(fetchBookshelves());

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
      });

      // Verify error handling when bookshelf fetching fails
      it("fetchBookshelves should handle generic Error and clear bookshelves", async () => {
        const mockError = new Error("failed");
        vi.mocked(BookshelfCommand.getAllBookshelves).mockRejectedValue(mockError);

        // Pre-fill state to verify clearing
        const preloadedState = {
          bookCollection: {
            ...bookCollectionInitialState,
            bookshelves: [createMockBookshelf()],
          },
        };
        store = createTestStore(preloadedState);

        await store.dispatch(fetchBookshelves());

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
        expect(state.bookshelves).toEqual([]);
      });

      // Verify state update on successful bookshelf creation
      it("addBookshelf should update status to succeeded on success", async () => {
        const mockBookshelf = createMockBookshelf({ id: 1, name: "New BS" });
        vi.mocked(BookshelfCommand.createBookshelf).mockResolvedValue(mockBookshelf);

        await store.dispatch(addBookshelf({ name: "New BS", icon_id: "folder" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("succeeded");
      });

      // Verify handling of CommandError during bookshelf creation
      it("addBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io error");
        vi.mocked(BookshelfCommand.createBookshelf).mockRejectedValue(mockError);

        await store.dispatch(addBookshelf({ name: "Existing BS", icon_id: "folder" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
      });

      // Verify handling of generic Error during bookshelf creation
      it("addBookshelf should handle generic Error", async () => {
        const mockError = new Error("unknown error");
        vi.mocked(BookshelfCommand.createBookshelf).mockRejectedValue(mockError);

        await store.dispatch(addBookshelf({ name: "Error BS", icon_id: "folder" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
      });

      // Verify error handling when bookshelf removal fails with no payload
      // Verify error handling when bookshelf removal fails with no payload
      it("removeBookshelf should handle failure with no payload", async () => {
        vi.mocked(BookshelfCommand.deleteBookshelf).mockImplementation(() => {
          throw new Error("fail");
        });

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error).toBeDefined();
      });

      // Verify that selectedId is reset if the selected bookshelf is deleted
      it("removeBookshelf should update selectedId if deleted", async () => {
        const preloadedState = {
          bookCollection: structuredClone(bookCollectionInitialState),
        };
        preloadedState.bookCollection.selectedId = 1;

        store = createTestStore(preloadedState);
        vi.mocked(BookshelfCommand.deleteBookshelf).mockResolvedValue(undefined);
        vi.mocked(BookshelfCommand.getAllBookshelves).mockResolvedValue([]);

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.selectedId).toBeNull();
      });

      // Verify that selectedId is maintained if a different bookshelf is deleted
      it("removeBookshelf should not change selectedId if different ID deleted", async () => {
        const preloadedState = {
          bookCollection: structuredClone(bookCollectionInitialState),
        };
        preloadedState.bookCollection.selectedId = 2;

        store = createTestStore(preloadedState);
        vi.mocked(BookshelfCommand.deleteBookshelf).mockResolvedValue(undefined);

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.selectedId).toBe(2);
      });

      // Verify error handling when bookshelf removal fails
      it("removeBookshelf should handle generic failure", async () => {
        vi.mocked(BookshelfCommand.deleteBookshelf).mockRejectedValue(new Error());

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
      });

      // Verify CommandError handling when bookshelf removal fails
      it("removeBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.DATABASE_ERROR, "db fail");
        vi.mocked(BookshelfCommand.deleteBookshelf).mockRejectedValue(mockError);

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      // Verify state update when switching bookshelves
      it("changeBookshelf should update selectedId and books", async () => {
        const mockBooks = [createMockBookWithState({ id: 10, display_name: "B1" })];
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(mockBooks);

        await store.dispatch(changeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.selectedId).toBe(1);
        expect(state.books).toEqual(mockBooks);
      });

      // Verify that all books are fetched when bookshelf selection is cleared (null)
      it("changeBookshelf(null) should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 10, display_name: "B1" })];
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(changeBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.selectedId).toBeNull();
        expect(state.books).toEqual(mockBooks);
      });

      // Verify error handling when bookshelf switching fails
      it("changeBookshelf should handle generic failure and clear state", async () => {
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockRejectedValue(new Error());

        // Pre-fill state to verify clearing
        const preloadedState = {
          bookCollection: {
            ...bookCollectionInitialState,
            selectedId: 1,
            books: [createMockBookWithState()],
          },
        };
        store = createTestStore(preloadedState);

        await store.dispatch(changeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.selectedId).toBeNull();
        expect(state.books).toEqual([]);
      });

      // Verify CommandError handling when bookshelf switching fails
      it("changeBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io fail");
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockRejectedValue(mockError);

        await store.dispatch(changeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
      });

      // Verify that book is added to bookshelf and status is updated
      it("addBookToBookshelf should add a book and update status", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["1.jpg"],
          is_novel: false,
        });
        vi.mocked(BookCommands.registerBook).mockResolvedValue(10);

        await store.dispatch(addBookToBookshelf({ bookshelfId: 1, bookPath: "path/to/book.zip" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("succeeded");
        expect(BookCommands.registerBook).toHaveBeenCalled();
      });

      // Verify that adding a book with no bookshelf ID (null) only registers it
      it("addBookToBookshelf with bookshelfId: null should register book", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["1.jpg"],
          is_novel: false,
        });
        vi.mocked(BookCommands.registerBook).mockResolvedValue(10);

        await store.dispatch(addBookToBookshelf({ bookshelfId: null, bookPath: "path" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("succeeded");
        expect(BookCommands.registerBook).toHaveBeenCalled();
      });

      // Verify handling of EPUB novel format when adding a book
      it("addBookToBookshelf for EPUB novel", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: [],
          is_novel: true,
        });
        vi.mocked(BookCommands.registerBook).mockResolvedValue(10);
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([]);

        await store.dispatch(addBookToBookshelf({ bookshelfId: null, bookPath: "path.epub" }));

        expect(ContainerCommands.getEntriesInContainer).toHaveBeenCalled();
        expect(BookCommands.registerBook).toHaveBeenCalledWith(
          expect.objectContaining({ totalPages: 0 }),
        );
      });

      // Verify handling of directory format when adding a book
      it("addBookToBookshelf for directory", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: true,
          entries: ["1.jpg"],
          is_novel: false,
        });
        vi.mocked(BookCommands.registerBook).mockResolvedValue(10);
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([]);

        await store.dispatch(addBookToBookshelf({ bookshelfId: null, bookPath: "dir" }));

        expect(BookCommands.registerBook).toHaveBeenCalledWith(
          expect.objectContaining({ itemType: "directory" }),
        );
      });

      // Verify error handling when book addition fails
      it("addBookToBookshelf should handle generic failure", async () => {
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(new Error());

        await store.dispatch(addBookToBookshelf({ bookshelfId: 1, bookPath: "path" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
      });

      // Verify CommandError handling when book addition fails
      it("addBookToBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io fail");
        vi.mocked(ContainerCommands.getEntriesInContainer).mockRejectedValue(mockError);

        await store.dispatch(addBookToBookshelf({ bookshelfId: 1, bookPath: "path" }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
      });

      // Verify state update when removing a book from the collection
      it("deleteBookFromCollection should remove book and update status", async () => {
        vi.mocked(BookshelfCommand.removeBookFromBookshelf).mockResolvedValue(undefined);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: 1 }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("succeeded");
      });

      // Verify that book is deleted from DB when removed with no bookshelf ID (null)
      it("deleteBookFromCollection with bookshelfId: null should delete book from DB", async () => {
        vi.mocked(BookCommands.deleteBook).mockResolvedValue(undefined);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: null }));

        expect(BookCommands.deleteBook).toHaveBeenCalledWith(10);
      });

      // Verify error handling when book deletion fails
      it("deleteBookFromCollection should handle generic failure", async () => {
        vi.mocked(BookCommands.deleteBook).mockRejectedValue(new Error());

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: null }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
      });

      // Verify CommandError handling when book deletion fails
      it("deleteBookFromCollection should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.DATABASE_ERROR, "db error");
        vi.mocked(BookCommands.deleteBook).mockRejectedValue(mockError);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: null }));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
      });

      // Verify state update on successful fetching of books in selected bookshelf
      it("fetchBooksInSelectedBookshelf should update state correctly", async () => {
        const mockBooks = [createMockBookWithState({ id: 1, file_path: "b1.zip" })];
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(mockBooks);

        await store.dispatch(fetchBooksInSelectedBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.books).toEqual(mockBooks);
      });

      // Verify that all books are fetched when fetchBooksInSelectedBookshelf is called with null
      it("fetchBooksInSelectedBookshelf(null) should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 1 })];
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(fetchBooksInSelectedBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.books).toEqual(mockBooks);
      });

      // Verify error handling when book fetching in selected bookshelf fails
      it("fetchBooksInSelectedBookshelf should handle generic failure and clear books", async () => {
        vi.mocked(BookCommands.getAllBooksWithState).mockRejectedValue(new Error());

        // Pre-fill state to verify clearing
        const preloadedState = {
          bookCollection: {
            ...bookCollectionInitialState,
            books: [createMockBookWithState()],
          },
        };
        store = createTestStore(preloadedState);

        await store.dispatch(fetchBooksInSelectedBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.books).toEqual([]);
      });

      // Verify CommandError handling when book fetching in selected bookshelf fails
      it("fetchBooksInSelectedBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io fail");
        vi.mocked(BookCommands.getAllBooksWithState).mockRejectedValue(mockError);

        await store.dispatch(fetchBooksInSelectedBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
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
    error: null as { code: ErrorCode; message?: string } | null,
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
      error: { code: ErrorCode.OTHER_ERROR },
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
      const mockError = new CommandError(ErrorCode.DATABASE_ERROR, "db error");
      vi.mocked(TagCommands.getAllTags).mockRejectedValue(mockError);

      await store.dispatch(fetchTags());

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
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
      expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
    });

    // Verify CommandError handling when tag creation fails
    it("addTag should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.IO_ERROR, "io fail");
      vi.mocked(TagCommands.createTag).mockRejectedValue(mockError);

      await store.dispatch(addTag({ name: "New Tag", color_code: "#00ff00" }));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
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
      expect(state.error?.code).toBe(ErrorCode.OTHER_ERROR);
    });

    // Verify CommandError handling when tag removal fails
    it("removeTag should handle CommandError", async () => {
      const mockError = new CommandError(ErrorCode.DATABASE_ERROR, "db fail");
      vi.mocked(TagCommands.deleteTag).mockRejectedValue(mockError);

      await store.dispatch(removeTag(1));

      const state = store.getState().tag;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });
});

describe("SeriesReducer", () => {
  let store: AppStore;

  const seriesInitialState = {
    series: [] as Series[],
    selectedId: null as number | null,
    books: [] as BookWithState[],
    isEditSeriesOrderDialogOpen: false,
    editSeriesOrderTargetId: null as number | null,
    status: "idle" as const,
    error: null as { code: ErrorCode; message?: string } | null,
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

  // Verify that edit series order dialog state is set correctly
  it("should handle setEditSeriesOrderDialogState", () => {
    const nextState = seriesReducer(
      seriesInitialState,
      setEditSeriesOrderDialogState({ isOpen: true, seriesId: 10 }),
    );
    expect(nextState.isEditSeriesOrderDialogOpen).toBe(true);
    expect(nextState.editSeriesOrderTargetId).toBe(10);
  });

  // Verify that series error state is cleared correctly
  it("should handle clearSeriesError", () => {
    const stateWithError = structuredClone(seriesInitialState);
    stateWithError.error = { code: ErrorCode.OTHER_ERROR };
    const nextState = seriesReducer(stateWithError, clearSeriesError());
    expect(nextState.error).toBeNull();
  });

  describe("Series Thunks", () => {
    it("updateSeriesOrdersThunk should update order", async () => {
      vi.mocked(BookCommands.updateSeriesOrders).mockResolvedValue(undefined);

      await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));

      expect(BookCommands.updateSeriesOrders).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("updateSeriesOrdersThunk should refetch the bookshelf after a successful update", async () => {
      vi.mocked(BookCommands.updateSeriesOrders).mockResolvedValue(undefined);
      vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([]);

      await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));

      // selectedId is null in the initial store, so the refetch hits getAllBooksWithState.
      expect(BookCommands.getAllBooksWithState).toHaveBeenCalled();
    });

    it("updateSeriesOrdersThunk should handle generic failure", async () => {
      vi.mocked(BookCommands.updateSeriesOrders).mockRejectedValue(new Error());

      const result = await store.dispatch(updateSeriesOrdersThunk([1, 2, 3]));
      expect(result.payload).toMatchObject({ code: ErrorCode.OTHER_ERROR });
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
      const mockError = new CommandError(ErrorCode.DATABASE_ERROR, "db fail");
      vi.mocked(SeriesCommand.getAllSeries).mockRejectedValue(mockError);

      await store.dispatch(fetchSeries());

      const state = store.getState().series;
      expect(state.status).toBe("failed");
      expect(state.error?.code).toBe(ErrorCode.DATABASE_ERROR);
    });
  });
});
