import type { Event } from "@tauri-apps/api/event";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadingState } from "../../../domain/book/schema";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import { readingProgressChanged } from "../../../store/actions";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchSeries } from "../../Bookshelf/seriesSlice";
import { fetchBookshelves, fetchBooksInSelectedBookshelf } from "../../Bookshelf/slice";
import { fetchTags } from "../../Bookshelf/tagSlice";
import { fetchRecentlyReadBooks } from "../slice";
import { useHistorySync } from "./useHistorySync";

// Mocks
vi.mock("../../../hooks/useTauriEvent");
vi.mock("../../../store/store");
vi.mock("../../Bookshelf/slice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../Bookshelf/slice")>();
  return {
    ...actual,
    fetchBookshelves: vi.fn(() => ({ type: "fetchBookshelves" })),
    fetchBooksInSelectedBookshelf: vi.fn((id: number) => ({
      type: "fetchBooksInSelectedBookshelf",
      payload: id,
    })),
  };
});
vi.mock("../../Bookshelf/seriesSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../Bookshelf/seriesSlice")>();
  return {
    ...actual,
    fetchSeries: vi.fn(() => ({ type: "fetchSeries" })),
  };
});
vi.mock("../../Bookshelf/tagSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../Bookshelf/tagSlice")>();
  return {
    ...actual,
    fetchTags: vi.fn(() => ({ type: "fetchTags" })),
  };
});
vi.mock("../slice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../slice")>();
  return {
    ...actual,
    fetchRecentlyReadBooks: vi.fn(() => ({ type: "fetchRecentlyReadBooks" })),
  };
});

describe("useHistorySync", () => {
  const mockDispatch = vi.fn();
  const mockSelectedBookshelfId = 1;
  const mockRecordReadingHistory = true;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useAppSelector).mockImplementation((selector) => {
      const state = {
        bookCollection: {
          selectedId: mockSelectedBookshelfId,
        },
        settings: {
          history: {
            recordReadingHistory: mockRecordReadingHistory,
          },
        },
      };
      return selector(state as unknown as RootState);
    });
  });

  it("performs initial data load on mount", () => {
    renderHook(() => useHistorySync());

    expect(mockDispatch).toHaveBeenCalledWith(fetchBookshelves());
    expect(mockDispatch).toHaveBeenCalledWith(fetchTags());
    expect(mockDispatch).toHaveBeenCalledWith(fetchSeries());
    expect(mockDispatch).toHaveBeenCalledWith(fetchRecentlyReadBooks());
    expect(mockDispatch).toHaveBeenCalledWith(
      fetchBooksInSelectedBookshelf(mockSelectedBookshelfId),
    );
  });

  it("re-fetches books when selectedBookshelfId changes", () => {
    let currentId = 1;
    vi.mocked(useAppSelector).mockImplementation((selector) => {
      const state = {
        bookCollection: {
          selectedId: currentId,
        },
        settings: {
          history: {
            recordReadingHistory: mockRecordReadingHistory,
          },
        },
      };
      return selector(state as unknown as RootState);
    });

    const { rerender } = renderHook(() => useHistorySync());
    expect(mockDispatch).toHaveBeenCalledWith(fetchBooksInSelectedBookshelf(1));

    currentId = 2;
    rerender();

    expect(mockDispatch).toHaveBeenCalledWith(fetchBooksInSelectedBookshelf(2));
  });

  it("re-fetches everything when 'history-changed' event is received", () => {
    let eventHandler: () => void = () => {};
    vi.mocked(useTauriEvent).mockImplementation((name, handler) => {
      if (name === "history-changed") {
        eventHandler = handler as () => void;
      }
    });

    renderHook(() => useHistorySync());
    vi.clearAllMocks();

    // Simulate event
    eventHandler();

    expect(mockDispatch).toHaveBeenCalledWith(fetchRecentlyReadBooks());
    expect(mockDispatch).toHaveBeenCalledWith(fetchBookshelves());
    expect(mockDispatch).toHaveBeenCalledWith(fetchTags());
    expect(mockDispatch).toHaveBeenCalledWith(fetchSeries());
    expect(mockDispatch).toHaveBeenCalledWith(
      fetchBooksInSelectedBookshelf(mockSelectedBookshelfId),
    );
  });

  it("does not fetch history if recordReadingHistory is false", () => {
    let eventHandler: () => void = () => {};
    vi.mocked(useTauriEvent).mockImplementation((name, handler) => {
      if (name === "history-changed") {
        eventHandler = handler as () => void;
      }
    });

    vi.mocked(useAppSelector).mockImplementation((selector) => {
      const state = {
        bookCollection: {
          selectedId: mockSelectedBookshelfId,
        },
        settings: {
          history: {
            recordReadingHistory: false,
          },
        },
      };
      return selector(state as unknown as RootState);
    });

    renderHook(() => useHistorySync());
    vi.clearAllMocks();

    // Simulate event
    eventHandler();

    expect(mockDispatch).not.toHaveBeenCalledWith(fetchRecentlyReadBooks());
    expect(mockDispatch).toHaveBeenCalledWith(
      fetchBooksInSelectedBookshelf(mockSelectedBookshelfId),
    );
  });

  it("patches the store in place on 'reading-progress-changed' without refetching", () => {
    let eventHandler: (event: Event<ReadingState>) => void = () => {};
    vi.mocked(useTauriEvent).mockImplementation((name, handler) => {
      if (name === "reading-progress-changed") {
        eventHandler = handler as (event: Event<ReadingState>) => void;
      }
    });

    renderHook(() => useHistorySync());
    vi.clearAllMocks();

    const payload: ReadingState = {
      book_id: 42,
      last_read_page_index: 7,
      last_opened_at: "2026-03-01T15:30:00",
    };
    eventHandler({ payload } as Event<ReadingState>);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith(readingProgressChanged(payload));
    // No IPC refetch thunks are dispatched for a page turn.
    expect(mockDispatch).not.toHaveBeenCalledWith(fetchRecentlyReadBooks());
    expect(mockDispatch).not.toHaveBeenCalledWith(fetchBookshelves());
    expect(mockDispatch).not.toHaveBeenCalledWith(fetchTags());
    expect(mockDispatch).not.toHaveBeenCalledWith(fetchSeries());
  });
});
