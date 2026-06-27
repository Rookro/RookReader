import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { createMockBookWithState } from "../../../test/factories";
import { useBookSelection } from "../hooks/useBookSelection";
import { useBookshelfDialogs } from "../hooks/useBookshelfDialogs";
import BookGrid from "./BookGrid";
import { BookSelectionContext } from "./BookSelectionContext";

// This suite focuses on the auto-scroll latch. Unlike BookGrid.test.tsx it uses the
// REAL useReadingBookSelection so the reading-book index actually resolves, and mocks
// react-window so grid.scrollToCell can be observed.

const mockScrollToCell = vi.fn();

vi.mock("../../../store/store");
vi.mock("../hooks/useBookSelection");
vi.mock("../hooks/useBookshelfDialogs");
vi.mock("../../../hooks/useResizeObserver");
vi.mock("../slice", async (importOriginal) => await importOriginal<typeof import("../slice")>());
vi.mock("../seriesSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../seriesSlice")>();
  return { ...actual, fetchSeries: vi.fn(() => ({ type: "fetchSeries" })) };
});
vi.mock("../tagSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tagSlice")>();
  return { ...actual, fetchTags: vi.fn(() => ({ type: "fetchTags" })) };
});
vi.mock("../../Settings/slice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../Settings/slice")>();
  return {
    ...actual,
    updateSettings: vi.fn((payload) => ({ type: "settings/updateSettings", payload })),
  };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-window so the grid imperative handle (scrollToCell) is observable.
vi.mock("react-window", () => ({
  useGridCallbackRef: (initial: unknown) => {
    const { useState } = require("react");
    return useState(initial);
  },
  Grid: ({ gridRef }: { gridRef: (handle: unknown) => void }) => {
    useEffect(() => {
      gridRef({ scrollToCell: mockScrollToCell });
    }, [gridRef]);
    return <div data-testid="mock-grid" />;
  },
}));

// Child components that are irrelevant to this suite.
vi.mock("./NavigationBar", () => ({ default: () => <div data-testid="navigation-bar" /> }));
vi.mock("./GridSizeControl", () => ({ default: () => <div data-testid="grid-size-control" /> }));
vi.mock("./FloatingActionBar", () => ({
  default: () => <div data-testid="floating-action-bar" />,
}));
vi.mock("./Dialog/AddBooksToBookshelvesDialog", () => ({ default: () => null }));
vi.mock("./Dialog/SetBookTagsDialog", () => ({ default: () => null }));
vi.mock("./Dialog/SetSeriesDialog", () => ({ default: () => null }));
vi.mock("./Dialog/BookDeleteDialog", () => ({ default: () => null }));
vi.mock("./Dialog/EditSeriesOrderDialog", () => ({ default: () => null }));

describe("BookGrid auto-scroll latch", () => {
  const mockDispatch = vi.fn();
  const mockSelectionValue = {
    selectedBookIds: new Set<number>(),
    toggleSelection: vi.fn(),
    setSelection: vi.fn(),
    clearSelection: vi.fn(),
    handleSelectionClick: vi.fn(),
  };

  const baseState = {
    settings: {
      bookshelf: { gridSize: 1, sortOrder: "name_asc", enableAutoScroll: true },
      general: { appFontFamily: "sans-serif" },
    },
    bookCollection: {
      searchText: "",
      books: [] as unknown[],
      bookshelves: [],
      selectedId: 1,
      status: "idle",
      error: null,
    },
    tag: { selectedId: null, tags: [] },
    series: {
      series: [],
      selectedId: null,
      isEditSeriesOrderDialogOpen: false,
      editSeriesOrderTargetId: null,
    },
    read: { containerFile: { book: null as unknown } },
    view: { activeView: "bookshelf" },
  };

  const makeState = (books: unknown[], readingBook: unknown) => ({
    ...baseState,
    bookCollection: { ...baseState.bookCollection, books },
    read: { containerFile: { book: readingBook } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useResizeObserver).mockReturnValue(1000);
    vi.mocked(useBookSelection).mockReturnValue(
      mockSelectionValue as unknown as ReturnType<typeof useBookSelection>,
    );
    vi.mocked(useBookshelfDialogs).mockReturnValue({
      dialogType: null,
      selectedBookIds: [],
      selectedBooks: [],
      openDialog: vi.fn(),
      closeDialog: vi.fn(),
    } as unknown as ReturnType<typeof useBookshelfDialogs>);
  });

  it("scrolls to the reading book once its index resolves after books finish loading", async () => {
    const otherBook = createMockBookWithState({ id: 1, display_name: "Other" });
    const readingBook = createMockBookWithState({ id: 5, display_name: "Reading" });

    // Initially the reading book is not yet in the loaded list (index -1) but a
    // reading book exists, so the latch must stay off.
    let state = makeState([otherBook], readingBook);
    vi.mocked(useAppSelector).mockImplementation(
      <T,>(selector: (s: RootState) => T): T => selector(state as unknown as RootState),
    );

    const { rerender } = render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    // No scroll yet: the reading book has not resolved into the list.
    await waitFor(() => {
      expect(mockScrollToCell).not.toHaveBeenCalled();
    });

    // Books finish loading; the reading book now appears in the list.
    state = makeState([otherBook, readingBook], readingBook);
    rerender(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    // The latch was not set on the first run, so a later run scrolls to the book.
    await waitFor(() => {
      expect(mockScrollToCell).toHaveBeenCalled();
    });
  });

  it("does not scroll when there is genuinely no reading book", async () => {
    const book = createMockBookWithState({ id: 1, display_name: "Only" });
    const state = makeState([book], null);
    vi.mocked(useAppSelector).mockImplementation(
      <T,>(selector: (s: RootState) => T): T => selector(state as unknown as RootState),
    );

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    await waitFor(() => {
      expect(mockScrollToCell).not.toHaveBeenCalled();
    });
  });
});
