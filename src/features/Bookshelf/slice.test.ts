import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../bindings/BookCommands";
import * as BookshelfCommand from "../../bindings/BookshelfCommand";
import * as ContainerCommands from "../../bindings/ContainerCommands";
import * as SeriesCommand from "../../bindings/SeriesCommand";
import * as TagCommands from "../../bindings/TagCommands";
import { createMockBookshelf, createMockBookWithState, createMockTag } from "../../test/factories";
import { type AppStore, createTestStore } from "../../test/utils";
import type { Bookshelf, BookWithState, Series, Tag } from "../../types/DatabaseModels";
import { CommandError, ErrorCode } from "../../types/Error";
import bookCollectionReducer, {
  addBookshelf,
  addBookToBookshelf,
  addTag,
  bookshelfAdded,
  changeBookshelf,
  clearBookshelfError,
  clearSeriesError,
  clearTagError,
  deleteBookFromCollection,
  fetchBookshelves,
  fetchBooksInSelectedBookshelf,
  fetchSeries,
  fetchTags,
  removeBookshelf,
  removeTag,
  setBookshelfSearchText,
  setSearchText,
  setSelectedSeriesId,
  setSelectedTag,
} from "./slice";

describe("BookCollectionReducer", () => {
  let store: AppStore;

  const initialState = {
    searchText: "",
    bookshelf: {
      bookshelves: [] as Bookshelf[],
      selectedId: null as number | null,
      books: [] as BookWithState[],
      status: "idle" as const,
      error: null as { code: ErrorCode; message?: string } | null,
    },
    tag: {
      tags: [] as Tag[],
      selectedId: null as number | null,
      status: "idle" as const,
      error: null as { code: ErrorCode; message?: string } | null,
    },
    series: {
      series: [] as Series[],
      selectedId: null as number | null,
      books: [] as BookWithState[],
      status: "idle" as const,
      error: null as { code: ErrorCode; message?: string } | null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is set correctly
  it("should handle initial state", () => {
    expect(bookCollectionReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  // Verify that search text is set correctly
  it("should handle setSearchText", () => {
    const nextState = bookCollectionReducer(initialState, setSearchText("query"));
    expect(nextState.searchText).toBe("query");
  });

  // Verify that selected tag ID is set correctly
  it("should handle setSelectedTag", () => {
    const nextState = bookCollectionReducer(initialState, setSelectedTag(1));
    expect(nextState.tag.selectedId).toBe(1);
  });

  // Verify that selected series ID is set correctly
  it("should handle setSelectedSeriesId", () => {
    const nextState = bookCollectionReducer(initialState, setSelectedSeriesId(1));
    expect(nextState.series.selectedId).toBe(1);
  });

  // Verify that state is updated when a bookshelf is added
  it("should handle bookshelfAdded", () => {
    const newBookshelf = createMockBookshelf({ id: 1, name: "New" });
    const nextState = bookCollectionReducer(initialState, bookshelfAdded(newBookshelf));
    expect(nextState.bookshelf.bookshelves).toContainEqual(newBookshelf);
  });

  // Verify that bookshelf search text is set correctly
  it("should handle setBookshelfSearchText", () => {
    const nextState = bookCollectionReducer(initialState, setBookshelfSearchText("search"));
    expect(nextState.searchText).toBe("search");
  });

  // Verify that bookshelf error state is cleared correctly
  it("should handle clearBookshelfError", () => {
    const stateWithError = structuredClone(initialState);
    stateWithError.bookshelf.error = { code: ErrorCode.OTHER_ERROR };
    const nextState = bookCollectionReducer(stateWithError, clearBookshelfError());
    expect(nextState.bookshelf.error).toBeNull();
  });

  // Verify that tag error state is cleared correctly
  it("should handle clearTagError", () => {
    const stateWithError = {
      ...initialState,
      tag: { ...initialState.tag, error: { code: ErrorCode.OTHER_ERROR } },
    };
    const nextState = bookCollectionReducer(stateWithError, clearTagError());
    expect(nextState.tag.error).toBeNull();
  });

  // Verify that series error state is cleared correctly
  it("should handle clearSeriesError", () => {
    const stateWithError = structuredClone(initialState);
    stateWithError.series.error = { code: ErrorCode.OTHER_ERROR };
    const nextState = bookCollectionReducer(stateWithError, clearSeriesError());
    expect(nextState.series.error).toBeNull();
  });

  describe("Async Thunk Integration Tests", () => {
    // Verify state update when rejected actions have undefined payload
    it("should handle rejected actions with undefined payload", () => {
      const action = { type: addBookshelf.rejected.type, payload: undefined };
      const nextState = bookCollectionReducer(initialState, action);
      expect(nextState.bookshelf.status).toBe("failed");
      expect(nextState.bookshelf.error).toBeNull();
    });

    describe("Bookshelf Thunks", () => {
      // Verify that bookshelf list is updated on success
      it("fetchBookshelves should update state with fetched bookshelves on success", async () => {
        const mockBookshelves = [createMockBookshelf({ id: 1, name: "BS1" })];
        vi.mocked(BookshelfCommand.getAllBookshelves).mockResolvedValue(mockBookshelves);

        await store.dispatch(fetchBookshelves());

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("succeeded");
        expect(state.bookshelf.bookshelves).toEqual(mockBookshelves);
      });

      // Verify handling of CommandError when fetching bookshelves
      it("fetchBookshelves should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "failed");
        vi.mocked(BookshelfCommand.getAllBookshelves).mockRejectedValue(mockError);

        await store.dispatch(fetchBookshelves());

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
        expect(state.bookshelf.error?.code).toBe(ErrorCode.IO_ERROR);
      });

      // Verify error handling when bookshelf fetching fails
      it("fetchBookshelves should handle failure", async () => {
        const mockError = new CommandError(ErrorCode.OTHER_ERROR, "failed");
        vi.mocked(BookshelfCommand.getAllBookshelves).mockRejectedValue(mockError);

        await store.dispatch(fetchBookshelves());

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
        expect(state.bookshelf.error?.code).toBe(ErrorCode.OTHER_ERROR);
      });

      // Verify state update on successful bookshelf creation
      it("addBookshelf should update state with new bookshelf on success", async () => {
        const mockBookshelf = createMockBookshelf({ id: 1, name: "New BS" });
        vi.mocked(BookshelfCommand.createBookshelf).mockResolvedValue(mockBookshelf);

        await store.dispatch(addBookshelf({ name: "New BS", icon_id: "folder" }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("succeeded");
        expect(state.bookshelf.bookshelves).toContainEqual(mockBookshelf);
      });

      // Verify handling of CommandError during bookshelf creation
      it("addBookshelf should handle CommandError", async () => {
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io error");
        vi.mocked(BookshelfCommand.createBookshelf).mockRejectedValue(mockError);

        await store.dispatch(addBookshelf({ name: "Existing BS", icon_id: "folder" }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
        expect(state.bookshelf.error?.code).toBe(ErrorCode.IO_ERROR);
      });

      // Verify error handling when bookshelf removal fails with no payload
      it("removeBookshelf should handle failure with no payload", async () => {
        vi.mocked(BookshelfCommand.deleteBookshelf).mockImplementation(() => {
          throw new Error("fail");
        });

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
        expect(state.bookshelf.error).toBeDefined();
      });

      // Verify that selectedId is reset if the selected bookshelf is deleted
      it("removeBookshelf should update selectedId if deleted", async () => {
        const preloadedState = { bookCollection: structuredClone(initialState) };
        preloadedState.bookCollection.bookshelf.selectedId = 1;

        store = createTestStore(preloadedState);
        vi.mocked(BookshelfCommand.deleteBookshelf).mockResolvedValue(undefined);
        vi.mocked(BookshelfCommand.getAllBookshelves).mockResolvedValue([]);

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.selectedId).toBeNull();
      });

      // Verify that selectedId is maintained if a different bookshelf is deleted
      it("removeBookshelf should not change selectedId if different ID deleted", async () => {
        const preloadedState = { bookCollection: structuredClone(initialState) };
        preloadedState.bookCollection.bookshelf.selectedId = 2;

        store = createTestStore(preloadedState);
        vi.mocked(BookshelfCommand.deleteBookshelf).mockResolvedValue(undefined);

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.selectedId).toBe(2);
      });

      // Verify error handling when bookshelf removal fails
      it("removeBookshelf should handle failure", async () => {
        vi.mocked(BookshelfCommand.deleteBookshelf).mockRejectedValue(new Error());

        await store.dispatch(removeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
      });

      // Verify state update when switching bookshelves
      it("changeBookshelf should update selectedId and books", async () => {
        const mockBooks = [createMockBookWithState({ id: 10, display_name: "B1" })];
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(mockBooks);

        await store.dispatch(changeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.selectedId).toBe(1);
        expect(state.bookshelf.books).toEqual(mockBooks);
      });

      // Verify that all books are fetched when bookshelf selection is cleared (null)
      it("changeBookshelf(null) should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 10, display_name: "B1" })];
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(changeBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.selectedId).toBeNull();
        expect(state.bookshelf.books).toEqual(mockBooks);
      });

      // Verify error handling when bookshelf switching fails
      it("changeBookshelf should handle failure", async () => {
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockRejectedValue(new Error());

        await store.dispatch(changeBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
      });
    });

    describe("Tag Thunks", () => {
      // Verify state update on successful tag fetching
      it("fetchTags should update state with fetched tags on success", async () => {
        const mockTags = [createMockTag({ id: 1, name: "T1" })];
        vi.mocked(TagCommands.getAllTags).mockResolvedValue(mockTags);

        await store.dispatch(fetchTags());

        const state = store.getState().bookCollection;
        expect(state.tag.status).toBe("succeeded");
        expect(state.tag.tags).toEqual(mockTags);
      });

      // Verify error handling when tag fetching fails
      it("fetchTags should handle failure", async () => {
        vi.mocked(TagCommands.getAllTags).mockRejectedValue(new Error());

        await store.dispatch(fetchTags());

        const state = store.getState().bookCollection;
        expect(state.tag.status).toBe("failed");
      });

      // Verify state update on successful tag creation
      it("addTag should update state with new tag on success", async () => {
        const mockTag = createMockTag({ id: 1, name: "New Tag" });
        vi.mocked(TagCommands.createTag).mockResolvedValue(mockTag);

        await store.dispatch(addTag({ name: "New Tag", color_code: "#00ff00" }));

        const state = store.getState().bookCollection;
        expect(state.tag.status).toBe("succeeded");
        expect(state.tag.tags).toContainEqual(mockTag);
      });

      // Verify error handling when tag creation fails
      it("addTag should handle failure", async () => {
        vi.mocked(TagCommands.createTag).mockRejectedValue(new Error());

        await store.dispatch(addTag({ name: "New Tag", color_code: "#00ff00" }));

        const state = store.getState().bookCollection.tag;
        expect(state.status).toBe("failed");
      });

      // Verify that selectedId is reset if the selected tag is deleted
      it("removeTag should update selectedId if deleted", async () => {
        const preloadedState = {
          bookCollection: structuredClone(initialState),
        };
        preloadedState.bookCollection.tag.selectedId = 1;

        store = createTestStore(preloadedState);
        vi.mocked(TagCommands.deleteTag).mockResolvedValue(undefined);
        vi.mocked(TagCommands.getAllTags).mockResolvedValue([]);

        await store.dispatch(removeTag(1));

        const state = store.getState().bookCollection;
        expect(state.tag.selectedId).toBeNull();
      });

      // Verify that selectedId is maintained if a different tag is deleted
      it("removeTag should not change selectedId if different ID deleted", async () => {
        const preloadedState = { bookCollection: structuredClone(initialState) };
        preloadedState.bookCollection.tag.selectedId = 2;

        store = createTestStore(preloadedState);
        vi.mocked(TagCommands.deleteTag).mockResolvedValue(undefined);

        await store.dispatch(removeTag(1));

        const state = store.getState().bookCollection;
        expect(state.tag.selectedId).toBe(2);
      });

      // Verify error handling when tag removal fails
      it("removeTag should handle failure", async () => {
        vi.mocked(TagCommands.deleteTag).mockRejectedValue(new Error());

        await store.dispatch(removeTag(1));

        const state = store.getState().bookCollection;
        expect(state.tag.status).toBe("failed");
      });
    });

    describe("Series Thunks", () => {
      // Verify state update on successful series fetching
      it("fetchSeries should update state with fetched series on success", async () => {
        const mockSeries: Series[] = [{ id: 1, name: "Series 1" }];
        vi.mocked(SeriesCommand.getAllSeries).mockResolvedValue(mockSeries);

        await store.dispatch(fetchSeries());

        const state = store.getState().bookCollection;
        expect(state.series.status).toBe("succeeded");
        expect(state.series.series).toEqual(mockSeries);
      });

      // Verify error handling when series fetching fails
      it("fetchSeries should handle failure", async () => {
        vi.mocked(SeriesCommand.getAllSeries).mockRejectedValue(new Error());

        await store.dispatch(fetchSeries());

        const state = store.getState().bookCollection;
        expect(state.series.status).toBe("failed");
      });
    });

    describe("Book Thunks", () => {
      // Verify that book is added to bookshelf and state is updated
      it("addBookToBookshelf should add a book and update state", async () => {
        const mockBooks = [createMockBookWithState({ id: 10, display_name: "book.zip" })];

        vi.mocked(ContainerCommands.determineEpubNovel).mockResolvedValue(false);
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["1.jpg"],
        });
        vi.mocked(BookCommands.upsertBook).mockResolvedValue(10);
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(mockBooks);

        await store.dispatch(addBookToBookshelf({ bookshelfId: 1, bookPath: "path/to/book.zip" }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("succeeded");
        expect(state.bookshelf.books).toEqual(mockBooks);
        expect(BookCommands.upsertBook).toHaveBeenCalled();
      });

      // Verify that all books are fetched when adding a book with no bookshelf ID (null)
      it("addBookToBookshelf with bookshelfId: null should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 10 })];
        vi.mocked(ContainerCommands.determineEpubNovel).mockResolvedValue(false);
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: false,
          entries: ["1.jpg"],
        });
        vi.mocked(BookCommands.upsertBook).mockResolvedValue(10);
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(addBookToBookshelf({ bookshelfId: null, bookPath: "path" }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.books).toEqual(mockBooks);
      });

      // Verify handling of EPUB novel format when adding a book
      it("addBookToBookshelf for EPUB novel", async () => {
        vi.mocked(ContainerCommands.determineEpubNovel).mockResolvedValue(true);
        vi.mocked(BookCommands.upsertBook).mockResolvedValue(10);
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([]);

        await store.dispatch(addBookToBookshelf({ bookshelfId: null, bookPath: "path.epub" }));

        expect(ContainerCommands.getEntriesInContainer).not.toHaveBeenCalled();
        expect(BookCommands.upsertBook).toHaveBeenCalledWith(
          expect.objectContaining({ totalPages: 0 }),
        );
      });

      // Verify handling of directory format when adding a book
      it("addBookToBookshelf for directory", async () => {
        vi.mocked(ContainerCommands.determineEpubNovel).mockResolvedValue(false);
        vi.mocked(ContainerCommands.getEntriesInContainer).mockResolvedValue({
          is_directory: true,
          entries: ["1.jpg"],
        });
        vi.mocked(BookCommands.upsertBook).mockResolvedValue(10);
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([]);

        await store.dispatch(addBookToBookshelf({ bookshelfId: null, bookPath: "dir" }));

        expect(BookCommands.upsertBook).toHaveBeenCalledWith(
          expect.objectContaining({ itemType: "directory" }),
        );
      });

      // Verify error handling when book addition fails
      it("addBookToBookshelf should handle failure", async () => {
        vi.mocked(ContainerCommands.determineEpubNovel).mockRejectedValue(new Error());

        await store.dispatch(addBookToBookshelf({ bookshelfId: 1, bookPath: "path" }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
      });

      // Verify state update when removing a book from the collection
      it("deleteBookFromCollection should remove book and update state", async () => {
        const mockBooksAfterDelete: BookWithState[] = [];

        vi.mocked(BookshelfCommand.removeBookFromBookshelf).mockResolvedValue(undefined);
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(
          mockBooksAfterDelete,
        );

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: 1 }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("succeeded");
        expect(state.bookshelf.books).toEqual(mockBooksAfterDelete);
      });

      // Verify that book is deleted from DB when removed with no bookshelf ID (null)
      it("deleteBookFromCollection with bookshelfId: null should delete book from DB", async () => {
        vi.mocked(BookCommands.deleteBook).mockResolvedValue(undefined);
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue([]);

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: null }));

        expect(BookCommands.deleteBook).toHaveBeenCalledWith(10);
        expect(BookCommands.getAllBooksWithState).toHaveBeenCalled();
      });

      // Verify error handling when book deletion fails
      it("deleteBookFromCollection should handle failure", async () => {
        vi.mocked(BookCommands.deleteBook).mockRejectedValue(new Error());

        await store.dispatch(deleteBookFromCollection({ bookId: 10, bookshelfId: null }));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
      });

      // Verify state update on successful fetching of books in selected bookshelf
      it("fetchBooksInSelectedBookshelf should update state correctly", async () => {
        const mockBooks = [createMockBookWithState({ id: 1, file_path: "b1.zip" })];
        vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(mockBooks);

        await store.dispatch(fetchBooksInSelectedBookshelf(1));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.books).toEqual(mockBooks);
      });

      // Verify that all books are fetched when fetchBooksInSelectedBookshelf is called with null
      it("fetchBooksInSelectedBookshelf(null) should fetch all books", async () => {
        const mockBooks = [createMockBookWithState({ id: 1 })];
        vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(mockBooks);

        await store.dispatch(fetchBooksInSelectedBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.books).toEqual(mockBooks);
      });

      // Verify error handling when book fetching in selected bookshelf fails
      it("fetchBooksInSelectedBookshelf should handle failure", async () => {
        vi.mocked(BookCommands.getAllBooksWithState).mockRejectedValue(new Error());

        await store.dispatch(fetchBooksInSelectedBookshelf(null));

        const state = store.getState().bookCollection;
        expect(state.bookshelf.status).toBe("failed");
      });
    });
  });
});
