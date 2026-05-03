import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockSeries, createMockTag } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookGridCell, { type BookGridCellProps, type GridItem } from "./BookGridCell";
import { BookSelectionContext } from "./BookSelectionContext";
import { BookshelfActionsContext } from "./BookshelfActionsContext";

describe("BookGridCell", () => {
  const user = userEvent.setup();

  const mockBook = createMockBookWithState({
    id: 1,
    display_name: "Test Book",
    total_pages: 100,
    last_read_page_index: 49,
    thumbnail_path: "thumbnail.jpg",
    tag_ids_str: "1,2",
  });

  const mockSeries = createMockSeries({
    id: 10,
    name: "Test Series",
  });

  const mockTags = [
    createMockTag({ id: 1, name: "Tag1", color_code: "#ff0000" }),
    createMockTag({ id: 2, name: "Tag2", color_code: "#00ff00" }),
  ];

  const defaultSelectionContext = {
    selectedBookIds: new Set<number>(),
    toggleSelection: vi.fn(),
    setSelection: vi.fn(),
    clearSelection: vi.fn(),
    handleSelectionClick: vi.fn(),
  };

  const mockActions = {
    openDialog: vi.fn(),
    refreshBookshelf: vi.fn(),
    refreshSeries: vi.fn(),
  };

  const defaultItems: GridItem[] = [{ type: "book", data: mockBook }];

  const defaultProps: BookGridCellProps = {
    items: defaultItems,
    tags: mockTags,
    enableAutoScroll: true,
    columnCount: 1,
    onBookClick: vi.fn(),
    onSeriesClick: vi.fn(),
    size: "medium",
  };

  const cellProps = {
    columnIndex: 0,
    rowIndex: 0,
    style: {},
    isScrolling: false,
  };

  const renderBookGridCell = (props = defaultProps, selectionContext = defaultSelectionContext) => {
    return renderWithProviders(
      <BookshelfActionsContext.Provider value={mockActions}>
        <BookSelectionContext.Provider value={selectionContext}>
          <BookGridCell
            ariaAttributes={{ "aria-colindex": 0, role: "gridcell" }}
            {...cellProps}
            {...props}
          />
        </BookSelectionContext.Provider>
      </BookshelfActionsContext.Provider>,
    );
  };

  it("should render book title and progress bar when item is a book", () => {
    renderBookGridCell();

    expect(screen.getByText("Test Book")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("should render tags when item is a book", () => {
    renderBookGridCell();

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
  });

  it("should render series name when item is a series", () => {
    const seriesItems: GridItem[] = [{ type: "series", data: mockSeries, books: [mockBook] }];
    renderBookGridCell({ ...defaultProps, items: seriesItems });

    expect(screen.getByText("Test Series")).toBeInTheDocument();
  });

  it("should call onBookClick when book is clicked", async () => {
    const onBookClick = vi.fn();
    renderBookGridCell({ ...defaultProps, onBookClick });

    const actionArea = screen.getByRole("button");
    await user.click(actionArea);

    expect(onBookClick).toHaveBeenCalledWith(mockBook, expect.anything());
  });

  it("should call onSeriesClick when series is clicked", async () => {
    const onSeriesClick = vi.fn();
    const seriesItems: GridItem[] = [{ type: "series", data: mockSeries, books: [mockBook] }];
    renderBookGridCell({ ...defaultProps, items: seriesItems, onSeriesClick });

    const actionArea = screen.getByRole("button");
    await user.click(actionArea);

    expect(onSeriesClick).toHaveBeenCalledWith(mockSeries.id);
  });

  it("should return null if item is not found at index", () => {
    const { container } = renderBookGridCell({ ...defaultProps, items: [] });
    expect(container.firstChild).toBeNull();
  });

  it("should display a checkmark when book is selected", () => {
    const selectionContext = {
      ...defaultSelectionContext,
      selectedBookIds: new Set([mockBook.id]),
    };
    renderBookGridCell(defaultProps, selectionContext);

    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
  });
});
