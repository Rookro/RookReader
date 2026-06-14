import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResizeObserver } from "../../../hooks/useResizeObserver";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { createMockBookWithState, createMockSeries } from "../../../test/factories";
import { useBookSelection } from "../hooks/useBookSelection";
import { useBookshelfDialogs } from "../hooks/useBookshelfDialogs";
import { useReadingBookSelection } from "../hooks/useReadingBookSelection";
import BookGrid from "./BookGrid";
import { BookSelectionContext } from "./BookSelectionContext";
import { useBookshelfActions } from "./BookshelfActionsContext";

// Mocks
vi.mock("../../../store/store");
vi.mock("../hooks/useBookSelection");
vi.mock("../hooks/useBookshelfDialogs");
vi.mock("../hooks/useReadingBookSelection");
vi.mock("../../../hooks/useResizeObserver");
vi.mock("../slice", async (importOriginal) => {
  return await importOriginal<typeof import("../slice")>();
});
vi.mock("../seriesSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../seriesSlice")>();
  return {
    ...actual,
    fetchSeries: vi.fn(() => ({ type: "fetchSeries" })),
  };
});
vi.mock("../tagSlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tagSlice")>();
  return {
    ...actual,
    fetchTags: vi.fn(() => ({ type: "fetchTags" })),
  };
});
vi.mock("../../Settings/slice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../Settings/slice")>();
  return {
    ...actual,
    updateSettings: vi.fn((payload) => ({ type: "settings/updateSettings", payload })),
  };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { searchText?: string }) => {
      if (key === "bookshelf.reading-chip-label") return "Reading";
      return options?.searchText ? `${key}:${options.searchText}` : key;
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock child components that are not the focus of this test or too complex
vi.mock("./NavigationBar", () => ({
  default: () => {
    const { openDialog } = useBookshelfActions();
    return (
      <div data-testid="navigation-bar">
        <button
          type="button"
          data-testid="context-open-dialog"
          onClick={() => openDialog("add-to-bookshelf", [])}
        >
          Context Open
        </button>
      </div>
    );
  },
}));
vi.mock("./GridSizeControl", () => ({
  default: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="grid-size-control">
      <button type="button" onClick={() => onChange(value + 1)}>
        Increase
      </button>
    </div>
  ),
}));
vi.mock("./FloatingActionBar", () => ({
  default: ({
    selectionCount,
    onClear,
    onAddToBookshelf,
    onSetTags,
    onSetSeries,
    onDelete,
  }: {
    selectionCount: number;
    onClear: () => void;
    onAddToBookshelf: () => void;
    onSetTags: () => void;
    onSetSeries: () => void;
    onDelete: () => void;
  }) => (
    <div data-testid="floating-action-bar">
      Selection: {selectionCount}
      <button type="button" onClick={onClear}>
        Clear
      </button>
      <button type="button" onClick={onAddToBookshelf}>
        Add to Bookshelf
      </button>
      <button type="button" onClick={onSetTags}>
        Set Tags
      </button>
      <button type="button" onClick={onSetSeries}>
        Set Series
      </button>
      <button type="button" onClick={onDelete}>
        Delete
      </button>
    </div>
  ),
}));

// Mock Dialogs to trigger callbacks
vi.mock("./Dialog/AddBooksToBookshelvesDialog", () => ({
  default: ({ onAddBooks, onClose }: { onAddBooks: () => void; onClose: () => void }) => (
    <div data-testid="add-books-dialog">
      <button type="button" data-testid="add-books-trigger" onClick={onAddBooks}>
        Trigger Add
      </button>
      <button type="button" data-testid="add-books-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
vi.mock("./Dialog/SetBookTagsDialog", () => ({
  default: ({ onUpdateTags, onClose }: { onUpdateTags: () => void; onClose: () => void }) => (
    <div data-testid="set-tags-dialog">
      <button type="button" data-testid="set-tags-trigger" onClick={onUpdateTags}>
        Trigger Set Tags
      </button>
      <button type="button" data-testid="set-tags-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
vi.mock("./Dialog/SetSeriesDialog", () => ({
  default: ({ onUpdateSeries, onClose }: { onUpdateSeries: () => void; onClose: () => void }) => (
    <div data-testid="set-series-dialog">
      <button type="button" data-testid="set-series-trigger" onClick={onUpdateSeries}>
        Trigger Set Series
      </button>
      <button type="button" data-testid="set-series-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
vi.mock("./Dialog/BookDeleteDialog", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="delete-books-dialog">
      <button type="button" data-testid="delete-books-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

describe("BookGrid", () => {
  const mockDispatch = vi.fn();
  const mockHandleSelectionClick = vi.fn();
  const mockClearSelection = vi.fn();
  const mockOpenDialog = vi.fn();
  const mockCloseDialog = vi.fn();

  const defaultState = {
    settings: {
      bookshelf: {
        gridSize: 1,
        sortOrder: "name_asc",
        enableAutoScroll: false,
      },
      general: {
        appFontFamily: "sans-serif",
      },
    },
    bookCollection: {
      searchText: "",
      books: [],
      bookshelves: [],
      selectedId: 1,
      status: "idle",
      error: null,
    },
    tag: {
      selectedId: null,
      tags: [],
    },
    series: {
      series: [],
      selectedId: null,
      isEditSeriesOrderDialogOpen: false,
      editSeriesOrderTargetId: null,
    },
    read: {
      containerFile: {
        book: null,
      },
    },
    view: {
      activeView: "bookshelf",
    },
  };

  const mockSelectionValue = {
    selectedBookIds: new Set<number>(),
    toggleSelection: vi.fn(),
    setSelection: vi.fn(),
    clearSelection: mockClearSelection,
    handleSelectionClick: mockHandleSelectionClick,
  };

  const mockDialogsValue = {
    dialogType: null,
    selectedBookIds: [],
    selectedBooks: [],
    openDialog: mockOpenDialog,
    closeDialog: mockCloseDialog,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppSelector).mockReset();
    vi.mocked(useAppDispatch).mockReset();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(defaultState as unknown as RootState);
    });
    vi.mocked(useResizeObserver).mockReturnValue(1000);
    vi.mocked(useBookSelection).mockReturnValue(
      mockSelectionValue as unknown as ReturnType<typeof useBookSelection>,
    );
    vi.mocked(useBookshelfDialogs).mockReturnValue(
      mockDialogsValue as unknown as ReturnType<typeof useBookshelfDialogs>,
    );
  });

  it("renders the loading state when status is loading", () => {
    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          status: "loading",
        },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders empty state when no books are present", () => {
    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("bookshelf.no-books")).toBeInTheDocument();
  });

  it("does not fetch books if active view is not bookshelf", () => {
    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        view: { activeView: "history" },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    // Initial fetch should only happen if view is bookshelf
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("renders books and series in the grid", () => {
    const book = createMockBookWithState({ id: 1, display_name: "Standalone Book" });
    const series = createMockSeries({ id: 10, name: "Series Name" });
    const seriesBook = createMockBookWithState({
      id: 2,
      display_name: "Series Book",
      series_id: 10,
    });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book, seriesBook],
        },
        series: { ...defaultState.series, series: [series] },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("Standalone Book")).toBeInTheDocument();
    expect(screen.getByText("Series Name")).toBeInTheDocument();
  });

  it("filters books by search text", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "Apple" });
    const book2 = createMockBookWithState({ id: 2, display_name: "Banana" });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          searchText: "app",
          books: [book1, book2],
        },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("shows no results message when search matches nothing", () => {
    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          searchText: "nothing",
          books: [],
        },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("bookshelf.no-search-results:nothing")).toBeInTheDocument();
  });

  it("handles grid size change", () => {
    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByText("Increase"));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining("updateSettings"),
        payload: { key: "bookshelf", value: expect.objectContaining({ gridSize: 2 }) },
      }),
    );
  });

  it("drills down into a series when clicked", () => {
    const series = createMockSeries({ id: 10, name: "Series Name" });
    const seriesBook = createMockBookWithState({
      id: 2,
      display_name: "Series Book",
      series_id: 10,
    });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [seriesBook],
        },
        series: { ...defaultState.series, series: [series] },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByText("Series Name"));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: 10, // setSelectedSeriesId payload
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bookCollection/setSearchText",
        payload: "",
      }),
    );
  });

  it("calls handleSelectionClick when a book is clicked", () => {
    const book = createMockBookWithState({ id: 1, display_name: "Test Book" });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book],
        },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByText("Test Book"));
    expect(mockHandleSelectionClick).toHaveBeenCalledWith(
      book,
      expect.anything(),
      expect.arrayContaining([book]),
      expect.any(Map),
      undefined,
    );
  });

  it("handles floating action bar actions", () => {
    const book = createMockBookWithState({ id: 1, display_name: "Test Book" });
    const mockSelection = {
      ...mockSelectionValue,
      selectedBookIds: new Set([1]),
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book],
        },
      } as unknown as RootState);
    });

    vi.mocked(useBookSelection).mockReturnValue(
      mockSelection as unknown as ReturnType<typeof useBookSelection>,
    );

    render(
      <BookSelectionContext.Provider value={mockSelection}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByText("Clear"));
    expect(mockClearSelection).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Add to Bookshelf"));
    expect(mockOpenDialog).toHaveBeenCalledWith("add-to-bookshelf", [book]);

    fireEvent.click(screen.getByText("Set Tags"));
    expect(mockOpenDialog).toHaveBeenCalledWith("set-tags", [book]);

    fireEvent.click(screen.getByText("Set Series"));
    expect(mockOpenDialog).toHaveBeenCalledWith("set-series", [book]);

    fireEvent.click(screen.getByText("Delete"));
    expect(mockOpenDialog).toHaveBeenCalledWith("delete-books", [book]);
  });

  it("handles keyboard navigation", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "Book 1" });
    const book2 = createMockBookWithState({ id: 2, display_name: "Book 2" });
    const series = createMockSeries({ id: 10, name: "Series" });

    const state = {
      ...defaultState,
      bookCollection: {
        ...defaultState.bookCollection,
        books: [book1, book2],
      },
      series: { ...defaultState.series, series: [series] },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    const container = screen.getByTestId("book-grid-container");

    // Start navigation with ArrowRight
    fireEvent.keyDown(container, { key: "ArrowRight" });
    fireEvent.keyDown(container, { key: "ArrowRight" });
    fireEvent.keyDown(container, { key: "ArrowLeft" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "End" });
    fireEvent.keyDown(container, { key: "Home" });
    fireEvent.keyDown(container, { key: "Enter" });
  });

  it("triggers actions on focused items via Enter key", () => {
    const book = createMockBookWithState({ id: 1, display_name: "Test Book" });
    const state = {
      ...defaultState,
      bookCollection: {
        ...defaultState.bookCollection,
        books: [book],
      },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    const container = screen.getByTestId("book-grid-container");

    // Focus and press Enter
    fireEvent.keyDown(container, { key: "ArrowRight" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(mockHandleSelectionClick).toHaveBeenCalledWith(
      book,
      expect.anything(),
      expect.arrayContaining([book]),
      expect.any(Map),
      undefined,
    );
  });

  it("calls onBookSelect when a book is clicked and no items are selected", () => {
    const book = createMockBookWithState({ id: 1, display_name: "Test Book" });
    const onBookSelect = vi.fn();
    const state = {
      ...defaultState,
      bookCollection: {
        ...defaultState.bookCollection,
        books: [book],
      },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    // Mock handleSelectionClick to call onBookSelect (simulating the real behavior)
    mockHandleSelectionClick.mockImplementation((b, _e, _books, _map, onSelect) => {
      onSelect?.(b);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid onBookSelect={onBookSelect} />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByText("Test Book"));
    expect(onBookSelect).toHaveBeenCalledWith(book);
  });

  it("handles keyboard navigation boundary conditions and other keys", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "A" });
    const book2 = createMockBookWithState({ id: 2, display_name: "B" });
    const state = {
      ...defaultState,
      bookCollection: {
        ...defaultState.bookCollection,
        books: [book1, book2],
      },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    const container = screen.getByTestId("book-grid-container");

    // Home/End
    fireEvent.keyDown(container, { key: "Home" });
    fireEvent.keyDown(container, { key: "End" });

    // Arrows from -1
    fireEvent.keyDown(container, { key: "ArrowLeft" }); // should go to 0
    fireEvent.keyDown(container, { key: "ArrowDown" }); // should go to 0
    fireEvent.keyDown(container, { key: "ArrowUp" }); // should go to 0

    // Space key
    fireEvent.keyDown(container, { key: " " });
    expect(mockHandleSelectionClick).toHaveBeenCalled();

    // Other key
    fireEvent.keyDown(container, { key: "Escape" });
  });

  it("handles empty grid keyboard navigation", () => {
    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    const container = screen.getByTestId("book-grid-container");
    fireEvent.keyDown(container, { key: "ArrowRight" });
    // Should not crash
  });

  it("triggers handleCloseDialog or fetch from dialogs", () => {
    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("add-books-trigger"));
    expect(mockCloseDialog).toHaveBeenCalled();
    expect(mockClearSelection).toHaveBeenCalled();

    vi.clearAllMocks();
    fireEvent.click(screen.getByTestId("set-tags-trigger"));
    expect(mockDispatch).toHaveBeenCalledWith({ type: "fetchTags" });
    expect(mockCloseDialog).not.toHaveBeenCalled();

    vi.clearAllMocks();
    fireEvent.click(screen.getByTestId("set-series-trigger"));
    expect(mockDispatch).toHaveBeenCalledWith({ type: "fetchSeries" });
    expect(mockCloseDialog).not.toHaveBeenCalled();
  });

  it("sorts multiple items", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "B" });
    const book2 = createMockBookWithState({ id: 2, display_name: "A" });
    const state = {
      ...defaultState,
      bookCollection: {
        ...defaultState.bookCollection,
        books: [book1, book2],
      },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("handles handleCloseDialog via dialog onClose", () => {
    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("add-books-close"));
    expect(mockCloseDialog).toHaveBeenCalled();
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it("triggers series drill-down on focused series item via Enter key", () => {
    const series = createMockSeries({ id: 10, name: "Test Series" });
    const book = createMockBookWithState({ id: 1, series_id: 10 });
    const state = {
      ...defaultState,
      bookCollection: {
        ...defaultState.bookCollection,
        books: [book],
      },
      series: { ...defaultState.series, series: [series] },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    const container = screen.getByTestId("book-grid-container");

    // Focus on the first item (should be the series because of sorting)
    fireEvent.keyDown(container, { key: "ArrowRight" });
    fireEvent.keyDown(container, { key: "Enter" });

    // Should call handleSeriesClick which dispatches setSelectedSeriesId
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: 10,
      }),
    );
  });

  it("calls openDialog from bookshelfActions context", () => {
    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("context-open-dialog"));
    expect(mockOpenDialog).toHaveBeenCalledWith("add-to-bookshelf", []);
  });

  it("filters books by tag", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "Tagged Book", tag_ids: [5] });
    const book2 = createMockBookWithState({ id: 2, display_name: "Untagged Book" });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book1, book2],
        },
        tag: { ...defaultState.tag, selectedId: 5 },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("Tagged Book")).toBeInTheDocument();
    expect(screen.queryByText("Untagged Book")).not.toBeInTheDocument();
  });

  it("falls back to standalone books when series data is missing", () => {
    const book = createMockBookWithState({ id: 1, display_name: "Orphaned Book", series_id: 99 });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book],
        },
        series: { ...defaultState.series, series: [] }, // Missing series 99
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("Orphaned Book")).toBeInTheDocument();
  });

  it("renders books in a series when drilled down", () => {
    const series = createMockSeries({ id: 10, name: "Series Name" });
    const seriesBook = createMockBookWithState({
      id: 2,
      display_name: "Series Book",
      series_id: 10,
    });
    const standaloneBook = createMockBookWithState({ id: 1, display_name: "Standalone" });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [seriesBook, standaloneBook],
        },
        series: { ...defaultState.series, series: [series], selectedId: 10 },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("Series Book")).toBeInTheDocument();
    expect(screen.queryByText("Standalone")).not.toBeInTheDocument();
  });

  it("covers all keyboard navigation branches", () => {
    const book1 = createMockBookWithState({ id: 1, display_name: "A" });
    const book2 = createMockBookWithState({ id: 2, display_name: "B" });
    const book3 = createMockBookWithState({ id: 3, display_name: "C" });
    const book4 = createMockBookWithState({ id: 4, display_name: "D" });

    // 400px / 190px = 2 columns
    vi.mocked(useResizeObserver).mockReturnValue(400);

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book1, book2, book3, book4],
        },
      } as unknown as RootState);
    });

    const { unmount } = render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    let container = screen.getByTestId("book-grid-container");

    // Test each arrow from -1 (fresh render for each to hit the true branch of focusedIndex === -1)
    fireEvent.keyDown(container, { key: "ArrowRight" });
    unmount();

    const { unmount: unmount2 } = render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );
    container = screen.getByTestId("book-grid-container");
    fireEvent.keyDown(container, { key: "ArrowLeft" });
    unmount2();

    const { unmount: unmount3 } = render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );
    container = screen.getByTestId("book-grid-container");
    fireEvent.keyDown(container, { key: "ArrowDown" });
    unmount3();

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );
    container = screen.getByTestId("book-grid-container");
    fireEvent.keyDown(container, { key: "ArrowUp" });

    // Now test boundaries from non -1
    fireEvent.keyDown(container, { key: "ArrowRight" }); // -> 1
    fireEvent.keyDown(container, { key: "ArrowRight" }); // -> 2
    fireEvent.keyDown(container, { key: "ArrowRight" }); // -> 3
    fireEvent.keyDown(container, { key: "ArrowRight" }); // -> 3 (clamped)

    fireEvent.keyDown(container, { key: "ArrowDown" }); // -> 3 (clamped)
    fireEvent.keyDown(container, { key: "ArrowLeft" }); // -> 2
    fireEvent.keyDown(container, { key: "ArrowUp" }); // -> 0 (2 - 2)
    fireEvent.keyDown(container, { key: "ArrowUp" }); // -> 0 (clamped)
  });

  it("sorts books in drill-down mode by series_order", () => {
    const series = createMockSeries({ id: 10, name: "Series" });
    const bookB = createMockBookWithState({
      id: 2,
      display_name: "B",
      series_id: 10,
      series_order: 2,
    });
    const bookA = createMockBookWithState({
      id: 1,
      display_name: "A",
      series_id: 10,
      series_order: 1,
    });
    const bookC = createMockBookWithState({
      id: 3,
      display_name: "C",
      series_id: 10,
      series_order: null,
    });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [bookC, bookB, bookA],
        },
        series: { ...defaultState.series, series: [series], selectedId: 10 },
      } as unknown as RootState);
    });

    const { container } = render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    // Verify visual rendering (A should be first, B second, C last because of null order)
    const elements = container.querySelectorAll(".MuiTypography-root");
    const textContents = Array.from(elements).map((e) => e.textContent);

    // We expect the text to contain A, B, C in that order. Since Grid virtualizes, it renders them in DOM order
    expect(textContents).toEqual(expect.arrayContaining(["A", "B", "C"]));

    const indexA = textContents.indexOf("A");
    const indexB = textContents.indexOf("B");
    const indexC = textContents.indexOf("C");

    expect(indexA).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexC);
  });

  it("groups multiple books in the same series", () => {
    const series = createMockSeries({ id: 10, name: "Series" });
    const book1 = createMockBookWithState({ id: 1, display_name: "Book 1", series_id: 10 });
    const book2 = createMockBookWithState({ id: 2, display_name: "Book 2", series_id: 10 });

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector({
        ...defaultState,
        bookCollection: {
          ...defaultState.bookCollection,
          books: [book1, book2],
        },
        series: { ...defaultState.series, series: [series] },
      } as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(screen.getByText("Series")).toBeInTheDocument();
  });

  it("calls useReadingBookSelection with the reading book from state", () => {
    const readingBook = createMockBookWithState({ id: 5, display_name: "Reading Book" });
    const state = {
      ...defaultState,
      read: {
        containerFile: {
          book: readingBook,
        },
      },
      bookCollection: {
        ...defaultState.bookCollection,
        books: [readingBook],
      },
    };

    vi.mocked(useAppSelector).mockImplementation(<T,>(selector: (state: RootState) => T): T => {
      return selector(state as unknown as RootState);
    });

    render(
      <BookSelectionContext.Provider value={mockSelectionValue}>
        <BookGrid />
      </BookSelectionContext.Provider>,
    );

    expect(useReadingBookSelection).toHaveBeenCalledWith(
      readingBook,
      expect.arrayContaining([expect.objectContaining({ data: readingBook })]),
      expect.any(Function),
    );
  });
});
