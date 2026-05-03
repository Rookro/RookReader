import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockBookshelf,
  createMockBookWithState,
  createMockSeries,
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
    fetchSeries: vi.fn(() => ({ type: "bookCollection/fetchSeries/dummy" })),
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
  const mockSeries = createMockSeries({ id: 100, name: "Series A" });
  const mockBooks = [
    createMockBookWithState({ id: 1, display_name: "Book 1", file_path: "p1", tag_ids_str: "10" }),
    createMockBookWithState({ id: 2, display_name: "Book 2", file_path: "p2", tag_ids_str: "20" }),
    createMockBookWithState({
      id: 3,
      display_name: "Series Book 1",
      file_path: "p3",
      series_id: 100,
    }),
    createMockBookWithState({
      id: 4,
      display_name: "Series Book 2",
      file_path: "p4",
      series_id: 100,
    }),
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
    series: { series: [mockSeries], selectedId: null, books: [], status: "idle", error: null },
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

  it("should render NavigationBar and Grid with books and series", async () => {
    renderBookGrid({ preloadedState: defaultPreloadedState });
    forceResize(1000);

    await waitFor(() => {
      expect(screen.getByText("Book 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Book 2")).toBeInTheDocument();
    expect(screen.getByText("Series A")).toBeInTheDocument();
    // Series books should be grouped, so individual series book names should NOT be directly in the grid
    expect(screen.queryByText("Series Book 1")).not.toBeInTheDocument();
  });

  it("should show only books of a series when series is selected (drill-down)", async () => {
    const drillDownState = structuredClone(defaultPreloadedState);
    drillDownState.bookCollection.series.selectedId = 100;

    renderBookGrid({ preloadedState: drillDownState });
    forceResize(1000);

    await waitFor(() => {
      expect(screen.getByText("Series Book 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Series Book 2")).toBeInTheDocument();
    expect(screen.queryByText("Book 1")).not.toBeInTheDocument();

    // The series name "Series A" appears in the Breadcrumbs, but it should not be in the grid.
    // We check that there is no button (card) with the series name.
    const gridContainer = screen.getByTestId("book-grid-container");
    expect(within(gridContainer).queryByText("Series A")).not.toBeInTheDocument();
  });

  it("should navigate to series drill-down when series card is clicked", async () => {
    const { store } = renderBookGrid({ preloadedState: defaultPreloadedState });
    forceResize(1000);

    const seriesCard = await screen.findByText("Series A");
    await user.click(seriesCard);

    expect(store.getState().bookCollection.series.selectedId).toBe(100);
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
    emptyState.bookCollection.series.series = [];

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

  it("should disconnect ResizeObserver on unmount", () => {
    const { unmount } = renderBookGrid({
      preloadedState: defaultPreloadedState,
    });
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
