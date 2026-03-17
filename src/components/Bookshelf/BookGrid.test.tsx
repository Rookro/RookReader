import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../test/utils";
import BookGrid from "./BookGrid";
import { mockStore } from "../../test/mocks/tauri";
import * as BookCollectionReducer from "../../reducers/BookCollectionReducer";
import { createMockBookWithState, createMockBookshelf, createMockTag } from "../../test/factories";

// Mock actions to prevent real thunks from running
vi.mock("../../reducers/BookCollectionReducer", async () => {
  const actual = (await vi.importActual("../../reducers/BookCollectionReducer")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    fetchBooksInSelectedBookshelf: vi.fn(() => ({ type: "bookCollection/fetchBooks/dummy" })),
    setGridSize: vi.fn((payload: number) => ({ type: "bookCollection/setGridSize", payload })),
  };
});

describe("BookGrid", () => {
  const user = userEvent.setup();
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Book 1", file_path: "p1", tag_ids_str: "10" }),
    createMockBookWithState({ id: 2, display_name: "Book 2", file_path: "p2", tag_ids_str: "20" }),
  ];

  const defaultPreloadedState = {
    bookCollection: {
      bookshelf: {
        bookshelves: [createMockBookshelf({ id: 1, name: "Shelf 1" })],
        books: mockBooks,
        selectedId: 1,
        status: "succeeded",
        error: null,
      },
      tag: {
        tags: [createMockTag({ id: 10, name: "T1" })],
        selectedId: null,
        status: "idle",
        error: null,
      },
      series: { series: [], selectedId: null, books: [], status: "idle", error: null },
      searchText: "",
      sortOrder: "NAME_ASC",
      gridSize: 1,
    },
    view: { activeView: "bookshelf" },
  } as unknown as RootState;

  let storedCallback: ResizeObserverCallback | null = null;
  let storedElement: HTMLElement | null = null;
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storedCallback = null;
    storedElement = null;

    // Stub global ResizeObserver to capture callback and element
    vi.stubGlobal(
      "ResizeObserver",
      class implements ResizeObserver {
        constructor(cb: ResizeObserverCallback) {
          storedCallback = cb;
        }
        observe(el: Element) {
          storedElement = el as HTMLElement;
          this.trigger(1000);
        }
        unobserve(_el: Element) {}
        disconnect() {
          mockDisconnect();
        }

        trigger(width: number) {
          if (storedCallback && storedElement) {
            const entry: Partial<ResizeObserverEntry> = {
              target: storedElement,
              contentRect: {
                width,
                height: 800,
                top: 0,
                left: 0,
                right: width,
                bottom: 800,
                x: 0,
                y: 0,
                toJSON: () => ({}),
              } as DOMRectReadOnly,
            };
            storedCallback([entry as ResizeObserverEntry], this);
          }
        }
      },
    );
  });

  const forceResize = (width: number) => {
    if (storedCallback && storedElement) {
      act(() => {
        const entry: Partial<ResizeObserverEntry> = {
          target: storedElement!,
          contentRect: {
            width,
            height: 800,
            top: 0,
            left: 0,
            right: width,
            bottom: 800,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRectReadOnly,
        };
        const mockObserver = {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        } as ResizeObserver;
        storedCallback!([entry as ResizeObserverEntry], mockObserver);
      });
    }
  };

  it("should render NavigationBar and Grid with books", async () => {
    renderWithProviders(<BookGrid />, { preloadedState: defaultPreloadedState });
    forceResize(1000);

    await waitFor(() => {
      expect(screen.getByText("Book 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Book 2")).toBeInTheDocument();
  });

  it("should show CircularProgress when loading", () => {
    const loadingState = {
      ...defaultPreloadedState,
      bookCollection: {
        ...defaultPreloadedState.bookCollection,
        bookshelf: { ...defaultPreloadedState.bookCollection.bookshelf, status: "loading" },
      },
    } as unknown as RootState;

    renderWithProviders(<BookGrid />, { preloadedState: loadingState });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show 'no books' message when collection is empty", async () => {
    const emptyState = {
      ...defaultPreloadedState,
      bookCollection: {
        ...defaultPreloadedState.bookCollection,
        bookshelf: { ...defaultPreloadedState.bookCollection.bookshelf, books: [] },
      },
    } as unknown as RootState;

    renderWithProviders(<BookGrid />, { preloadedState: emptyState });
    expect(await screen.findByText(/No books in this collection/i)).toBeInTheDocument();
  });

  it("should filter books by tag", async () => {
    const taggedState = {
      ...defaultPreloadedState,
      bookCollection: {
        ...defaultPreloadedState.bookCollection,
        tag: { ...defaultPreloadedState.bookCollection.tag, selectedId: 10 },
      },
    } as unknown as RootState;

    renderWithProviders(<BookGrid />, { preloadedState: taggedState });
    forceResize(1000);

    await waitFor(() => {
      expect(screen.getByText("Book 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Book 2")).not.toBeInTheDocument();
  });

  it("should open Set Tags dialog from context menu", async () => {
    renderWithProviders(<BookGrid />, { preloadedState: defaultPreloadedState });
    forceResize(1000);

    const bookCell = await screen.findByTestId("book-cell-0");
    await user.pointer({ keys: "[MouseRight]", target: bookCell });

    const setTagsItem = await screen.findByText(/Set tags/i);
    await user.click(setTagsItem);

    expect(await screen.findByText(/Set Tags/i)).toBeInTheDocument();

    // Close dialog
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);
    await waitFor(() => {
      expect(screen.queryByText(/Set Tags/i)).not.toBeInTheDocument();
    });
  });

  it("should open Delete Book dialog from context menu", async () => {
    renderWithProviders(<BookGrid />, { preloadedState: defaultPreloadedState });
    forceResize(1000);

    const bookCell = await screen.findByTestId("book-cell-0");
    await user.pointer({ keys: "[MouseRight]", target: bookCell });

    const deleteItem = await screen.findByText(/Remove book/i);
    await user.click(deleteItem);

    expect(
      await screen.findByText(/Are you sure you want to delete this book/i),
    ).toBeInTheDocument();

    // Close dialog
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);
    await waitFor(() => {
      expect(
        screen.queryByText(/Are you sure you want to delete this book/i),
      ).not.toBeInTheDocument();
    });
  });

  it("should close context menu on backdrop click", async () => {
    renderWithProviders(<BookGrid />, { preloadedState: defaultPreloadedState });
    forceResize(1000);

    const bookCell = await screen.findByTestId("book-cell-0");
    await user.pointer({ keys: "[MouseRight]", target: bookCell });
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    // Click on container to close
    const container = screen.getByTestId("book-grid-container");
    // Actually handleContextMenu in BookGrid calls setContextMenu(null) if it exists.
    fireEvent.contextMenu(container);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("should update gridSize and store when slider changes", async () => {
    renderWithProviders(<BookGrid />, { preloadedState: defaultPreloadedState });
    forceResize(1000);

    const slider = await screen.findByRole("slider");
    fireEvent.change(slider, { target: { value: 2 } });

    expect(BookCollectionReducer.setGridSize).toHaveBeenCalledWith(2);
    expect(mockStore.set).toHaveBeenCalledWith("bookshelf-grid-size", 2);
  });

  it("should disconnect ResizeObserver on unmount", () => {
    const { unmount } = renderWithProviders(<BookGrid />, {
      preloadedState: defaultPreloadedState,
    });
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
