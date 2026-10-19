import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookWithState } from "../../../domain/book/schema";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import { createBasePreloadedState, createTestStore, createTestWrapper } from "../../../test/utils";
import { openContainerFile } from "../../BookReader/slice";
import { setActiveView } from "../../MainView/slice";
import { setSelectedSeriesId } from "../seriesSlice";
import { fetchBooksInSelectedBookshelf, setSelectedBookshelf } from "../slice";
import { useRevealReadingBook } from "./useRevealReadingBook";

describe("useRevealReadingBook", () => {
  const series = createMockSeries({ id: 10, name: "Saga" });
  const otherSeries = createMockSeries({ id: 20, name: "Other Saga" });
  const volume1 = createMockBookWithState({ id: 1, display_name: "Saga 1", series_id: 10 });
  const volume2 = createMockBookWithState({ id: 2, display_name: "Saga 2", series_id: 10 });
  const otherVolume = createMockBookWithState({ id: 3, display_name: "Other 1", series_id: 20 });
  const standalone = createMockBookWithState({ id: 4, display_name: "Standalone" });

  const setup = ({
    readingBook = volume2,
    books = [volume1, volume2, otherVolume, standalone],
    activeView = "bookshelf",
    booksStatus = "succeeded",
    selectedSeriesId = null,
    tagId = null,
    searchText = "",
    readerLoading = false,
    booksRefreshing = false,
  }: {
    readingBook?: BookWithState | null;
    books?: BookWithState[];
    activeView?: "reader" | "bookshelf";
    booksStatus?: "idle" | "loading" | "succeeded" | "failed";
    selectedSeriesId?: number | null;
    tagId?: number | null;
    searchText?: string;
    readerLoading?: boolean;
    booksRefreshing?: boolean;
  } = {}) => {
    const state = createBasePreloadedState();
    state.view.activeView = activeView;
    state.read.containerFile.book = readingBook;
    state.read.containerFile.history = ["/s/v2.zip"];
    state.read.containerFile.historyIndex = 0;
    state.read.containerFile.isLoading = readerLoading;
    state.bookCollection.books = books;
    state.bookCollection.status = booksStatus;
    state.bookCollection.isRefreshing = booksRefreshing;
    // The request a test's fulfilled action answers.
    state.bookCollection.booksRequestId = "request-id";
    state.bookCollection.searchText = searchText;
    state.series.series = [series, otherSeries];
    state.series.status = "succeeded";
    state.series.selectedId = selectedSeriesId;
    state.tag.selectedId = tagId;
    const store = createTestStore(state);
    renderHook(() => useRevealReadingBook(), { wrapper: createTestWrapper({ store }) });
    return store;
  };

  it("opens the series that holds the reading book", () => {
    const store = setup();

    expect(store.getState().series.selectedId).toBe(10);
  });

  it("clears the search that found the series, as clicking its cover does", () => {
    const store = setup({ searchText: "Saga" });

    expect(store.getState().series.selectedId).toBe(10);
    expect(store.getState().bookCollection.searchText).toBe("");
  });

  it("switches from another open series to the reading book's series", () => {
    const store = setup({ selectedSeriesId: 20 });

    expect(store.getState().series.selectedId).toBe(10);
  });

  it("returns to the top level when the reading book is not in a series", () => {
    const store = setup({ readingBook: standalone, selectedSeriesId: 20, searchText: "Stand" });

    expect(store.getState().series.selectedId).toBeNull();
    expect(store.getState().bookCollection.searchText).toBe("Stand");
  });

  it("leaves the bookshelf alone when the reading book is not in the collection", () => {
    const store = setup({ books: [otherVolume, standalone], selectedSeriesId: 20 });

    expect(store.getState().series.selectedId).toBe(20);
  });

  it("leaves the bookshelf alone when the tag filter hides the reading book", () => {
    const store = setup({ tagId: 99 });

    expect(store.getState().series.selectedId).toBeNull();
  });

  it("leaves the bookshelf alone when the search hides the reading book's series", () => {
    const store = setup({ searchText: "Standalone" });

    expect(store.getState().series.selectedId).toBeNull();
    expect(store.getState().bookCollection.searchText).toBe("Standalone");
  });

  // The reader forgets its book while the next one opens; deciding then would miss it
  it("waits while the reader is opening a book", () => {
    const store = setup({ readerLoading: true });

    expect(store.getState().series.selectedId).toBeNull();

    act(() => {
      store.dispatch(
        openContainerFile.fulfilled(
          {
            entries: ["p1"],
            isDirectory: false,
            isNovel: false,
            book: volume2,
            readingDirection: "rtl",
            bookRecordError: null,
          },
          "r",
          "/s/v2.zip",
        ),
      );
    });

    expect(store.getState().series.selectedId).toBe(10);
  });

  // A refetch in place keeps the old list on screen; deciding on it could miss the book
  it("waits while the books are being refetched, then reveals", () => {
    const store = setup({ booksRefreshing: true });

    expect(store.getState().series.selectedId).toBeNull();

    act(() => {
      store.dispatch(
        fetchBooksInSelectedBookshelf.fulfilled([volume1, volume2], "request-id", null),
      );
    });

    expect(store.getState().series.selectedId).toBe(10);
  });

  it("does nothing while the reader view is shown", () => {
    const store = setup({ activeView: "reader" });

    expect(store.getState().series.selectedId).toBeNull();
  });

  it("waits for the books to finish loading", () => {
    const store = setup({ books: [], booksStatus: "loading" });
    expect(store.getState().series.selectedId).toBeNull();

    act(() => {
      store.dispatch(
        fetchBooksInSelectedBookshelf.fulfilled([volume1, volume2], "request-id", null),
      );
    });

    expect(store.getState().series.selectedId).toBe(10);
  });

  it("reveals once per visit, so going back with the breadcrumb sticks", () => {
    const store = setup();
    expect(store.getState().series.selectedId).toBe(10);

    act(() => {
      store.dispatch(setSelectedSeriesId(null));
    });
    expect(store.getState().series.selectedId).toBeNull();

    act(() => {
      store.dispatch(setActiveView("reader"));
    });
    act(() => {
      store.dispatch(setActiveView("bookshelf"));
    });
    expect(store.getState().series.selectedId).toBe(10);
  });

  it("does not reopen the series after the collection is switched", () => {
    const store = setup();
    expect(store.getState().series.selectedId).toBe(10);

    act(() => {
      store.dispatch(setSelectedBookshelf(2));
    });
    act(() => {
      store.dispatch(fetchBooksInSelectedBookshelf.fulfilled([volume1, volume2], "request-id", 2));
    });

    expect(store.getState().series.selectedId).toBeNull();
  });
});
