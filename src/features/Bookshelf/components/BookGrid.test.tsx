import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockBookshelf,
  createMockBookWithState,
  createMockTag,
} from "../../../test/factories";
import { createBasePreloadedState, type RootState, renderWithProviders } from "../../../test/utils";
import * as SettingsReducer from "../../Settings/slice";
import BookGrid from "./BookGrid";
import { BookSelectionProvider } from "./BookSelectionContext";

// Mock actions to prevent real thunks from running
vi.mock("../slice", async () => {
  const actual = await vi.importActual("../slice");
  return {
    ...actual,
    fetchBooksInSelectedBookshelf: vi.fn(() => ({ type: "bookCollection/fetchBooks/dummy" })),
  };
});

vi.mock("../../Settings/slice", async () => {
  const actual = await vi.importActual("../../Settings/slice");
  return {
    ...actual,
    updateSettings: vi.fn((payload: { key: string; value: unknown }) => ({
      type: "settings/updateSettings",
      payload,
    })),
  };
});

describe("BookGrid", () => {
  const user = userEvent.setup();
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Book 1", file_path: "p1", tag_ids_str: "10" }),
    createMockBookWithState({ id: 2, display_name: "Book 2", file_path: "p2", tag_ids_str: "20" }),
  ];

  const defaultPreloadedState = createBasePreloadedState();
  defaultPreloadedState.bookCollection = {
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
  };
  defaultPreloadedState.view.activeView = "bookshelf";

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
      const callback = storedCallback;
      const element = storedElement;
      act(() => {
        const entry: Partial<ResizeObserverEntry> = {
          target: element,
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
        callback([entry as ResizeObserverEntry], mockObserver);
      });
    }
  };

  const renderBookGrid = (options?: { preloadedState?: RootState }) => {
    return renderWithProviders(
      <BookSelectionProvider>
        <BookGrid />
      </BookSelectionProvider>,
      options,
    );
  };

  it("should render NavigationBar and Grid with books", async () => {
    renderBookGrid({ preloadedState: defaultPreloadedState });
    forceResize(1000);

    await waitFor(() => {
      expect(screen.getByText("Book 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Book 2")).toBeInTheDocument();
  });

  it("should show CircularProgress when loading", () => {
    const loadingState = structuredClone(defaultPreloadedState);
    loadingState.bookCollection.bookshelf.status = "loading" as const;

    renderBookGrid({ preloadedState: loadingState });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show 'no books' message when collection is empty", async () => {
    const emptyState = structuredClone(defaultPreloadedState);
    emptyState.bookCollection.bookshelf.books = [];

    renderBookGrid({ preloadedState: emptyState });
    expect(await screen.findByText(/No books in this collection/i)).toBeInTheDocument();
  });

  it("should filter books by tag", async () => {
    const taggedState = structuredClone(defaultPreloadedState);
    taggedState.bookCollection.tag.selectedId = 10;

    renderBookGrid({ preloadedState: taggedState });
    forceResize(1000);

    await waitFor(() => {
      expect(screen.getByText("Book 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Book 2")).not.toBeInTheDocument();
  });

  it("should open Set Tags dialog from context menu", async () => {
    renderBookGrid({ preloadedState: defaultPreloadedState });
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

  it("should open Add to Collection dialog from context menu", async () => {
    renderBookGrid({ preloadedState: defaultPreloadedState });
    forceResize(1000);

    const bookCell = await screen.findByTestId("book-cell-0");
    await user.pointer({ keys: "[MouseRight]", target: bookCell });

    const addToCollectionItem = await screen.findByText(/Add to Collection|コレクションに追加/i);
    await user.click(addToCollectionItem);

    // The title of the dialog is "Add to Collection(s)" or "コレクションに追加"
    const dialogTitle = await screen.findAllByText(/Add to Collection|コレクションに追加/i);
    expect(dialogTitle.length).toBeGreaterThan(0);

    // Close dialog
    const cancelButton = screen.getByRole("button", { name: /cancel|キャンセル/i });
    await user.click(cancelButton);
    await waitFor(() => {
      // Find dialog specifically to make sure it's gone. Using queryByRole dialog is safer.
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should open Delete Book dialog from context menu", async () => {
    renderBookGrid({ preloadedState: defaultPreloadedState });
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
    renderBookGrid({ preloadedState: defaultPreloadedState });
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
    renderBookGrid({ preloadedState: defaultPreloadedState });
    forceResize(1000);

    const slider = await screen.findByRole("slider");
    fireEvent.change(slider, { target: { value: 2 } });

    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "bookshelf",
      value: expect.objectContaining({ gridSize: 2 }),
    });
  });

  describe("Unified Dialog Management", () => {
    it("should open Set Tags dialog via context menu with the specific book", async () => {
      renderBookGrid({ preloadedState: defaultPreloadedState });
      forceResize(1000);

      const bookCell = await screen.findByTestId("book-cell-0");
      await user.pointer({ keys: "[MouseRight]", target: bookCell });

      const setTagsItem = await screen.findByText(/Set tags/i);
      await user.click(setTagsItem);

      // Verify SetTagsDialog is open (title check)
      expect(await screen.findByText("Set Tags")).toBeInTheDocument();
      // The dialog should have the tag of Book 1 (at least one instance)
      expect(screen.getAllByText("T1").length).toBeGreaterThan(0);
    });

    it("should close dialog and clear data when onClose is called", async () => {
      renderBookGrid({ preloadedState: defaultPreloadedState });
      forceResize(1000);

      const bookCell = await screen.findByTestId("book-cell-0");
      await user.pointer({ keys: "[MouseRight]", target: bookCell });
      await user.click(await screen.findByText(/Set tags/i));

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Multiple Selection", () => {
    it("should toggle selection when Ctrl-clicking a book", async () => {
      renderBookGrid({ preloadedState: defaultPreloadedState });
      forceResize(1000);

      await waitFor(() => {
        expect(screen.getByText("Book 1")).toBeInTheDocument();
      });

      // Initially action bar should not be visible
      expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();

      const book1Cell = await screen.findByText("Book 1");
      const book1Button = book1Cell.closest("button");
      assert(book1Button, "book1Button should be found");

      // Ctrl+click
      await user.keyboard("[ControlLeft>]");
      await user.click(book1Button);
      await user.keyboard("[/ControlLeft]");

      // Action bar should appear with count 1
      expect(await screen.findByText(/1 selected/i)).toBeInTheDocument();

      const book2Cell = await screen.findByText("Book 2");
      const book2Button = book2Cell.closest("button");
      assert(book2Button, "book2Button should be found");

      // Ctrl+click second book
      await user.keyboard("[ControlLeft>]");
      await user.click(book2Button);
      await user.keyboard("[/ControlLeft]");

      // Count should be 2
      expect(await screen.findByText(/2 selected/i)).toBeInTheDocument();

      // Ctrl+click first book again to deselect
      await user.keyboard("[ControlLeft>]");
      await user.click(book1Button);
      await user.keyboard("[/ControlLeft]");

      // Count should be 1
      expect(await screen.findByText(/1 selected/i)).toBeInTheDocument();
    });

    it("should select range when Shift-clicking books", async () => {
      renderBookGrid({ preloadedState: defaultPreloadedState });
      forceResize(1000);

      await waitFor(() => {
        expect(screen.getByText("Book 1")).toBeInTheDocument();
      });

      const book1Button = (await screen.findByText("Book 1")).closest("button");
      const book2Button = (await screen.findByText("Book 2")).closest("button");
      assert(book1Button, "book1Button should be found");
      assert(book2Button, "book2Button should be found");

      // Ctrl+click first book
      await user.keyboard("[ControlLeft>]");
      await user.click(book1Button);
      await user.keyboard("[/ControlLeft]");

      // Shift+click second book
      await user.keyboard("[ShiftLeft>]");
      await user.click(book2Button);
      await user.keyboard("[/ShiftLeft]");

      // Action bar should show 2 selected
      expect(await screen.findByText(/2 selected/i)).toBeInTheDocument();
    });

    it("should open Delete Book dialog for multiple selections", async () => {
      renderBookGrid({ preloadedState: defaultPreloadedState });
      forceResize(1000);

      const book1Button = (await screen.findByText("Book 1")).closest("button");
      const book2Button = (await screen.findByText("Book 2")).closest("button");
      assert(book1Button, "book1Button should be found");
      assert(book2Button, "book2Button should be found");

      // Ctrl+click both books
      await user.keyboard("[ControlLeft>]");
      await user.click(book1Button);
      await user.click(book2Button);
      await user.keyboard("[/ControlLeft]");

      // Click remove button in action bar
      const removeButton = await screen.findByRole("button", { name: /Remove book/i });
      await user.click(removeButton);

      // Dialog should show up saying "2 books"
      expect(await screen.findByText(/2 books/i)).toBeInTheDocument();
    });

    it("should clear selection when Clear button is clicked", async () => {
      renderBookGrid({ preloadedState: defaultPreloadedState });
      forceResize(1000);

      const book1Button = (await screen.findByText("Book 1")).closest("button");
      assert(book1Button, "book1Button should be found");

      // Ctrl+click to select
      await user.keyboard("[ControlLeft>]");
      await user.click(book1Button);
      await user.keyboard("[/ControlLeft]");
      expect(await screen.findByText(/1 selected/i)).toBeInTheDocument();

      // Click clear selection button
      const clearButton = await screen.findByTitle(/Clear selection/i);
      await user.click(clearButton);

      // Action bar should disappear
      await waitFor(() => {
        expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
      });
    });
  });

  it("should disconnect ResizeObserver on unmount", () => {
    const { unmount } = renderBookGrid({
      preloadedState: defaultPreloadedState,
    });
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
