import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockTag } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookCard from "./BookCard";
import { SelectionContext } from "./BookGrid";

describe("BookCard", () => {
  const user = userEvent.setup();

  const mockBook = createMockBookWithState({
    id: 1,
    display_name: "Test Book",
    total_pages: 100,
    last_read_page_index: 49, // Page 50
    thumbnail_path: "thumbnail.jpg",
    tag_ids_str: "1,2",
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
    lastClickedBookId: null,
    setLastClickedBookId: vi.fn(),
  };

  const defaultProps = {
    books: [mockBook],
    tags: mockTags,
    columnCount: 1,
    columnIndex: 0,
    rowIndex: 0,
    onBookClick: vi.fn(),
    onBookContextMenu: vi.fn(),
    size: "medium" as const,
    style: {},
    index: 0,
    isScrolling: false,
    ariaAttributes: {
      "aria-colindex": 1,
      role: "gridcell" as const,
    },
  };

  const renderBookCard = (props = defaultProps, selectionContext = defaultSelectionContext) => {
    return renderWithProviders(
      <SelectionContext.Provider value={selectionContext}>
        <BookCard {...props} />
      </SelectionContext.Provider>,
    );
  };

  // Verify that the book title and reading progress bar are displayed correctly
  it("should render book title and progress bar", () => {
    renderBookCard();

    expect(screen.getByText("Test Book")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  // Verify that the tags associated with the book are displayed correctly
  it("should render tags", () => {
    renderBookCard();

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
  });

  // Verify that onBookClick callback is called correctly when the card is clicked
  it("should call onBookClick when clicked", async () => {
    const onBookClick = vi.fn();
    renderBookCard({ ...defaultProps, onBookClick });

    const actionArea = screen.getByRole("button");
    await user.click(actionArea);

    expect(onBookClick).toHaveBeenCalledWith(mockBook, expect.anything());
  });

  // Verify that the callback for displaying the context menu is called correctly when the card is right-clicked
  it("should call onBookContextMenu when right clicked", async () => {
    const onBookContextMenu = vi.fn();
    renderBookCard({ ...defaultProps, onBookContextMenu });

    const actionArea = screen.getByRole("button");
    await user.pointer({ keys: "[MouseRight]", target: actionArea });

    expect(onBookContextMenu).toHaveBeenCalledWith(mockBook, expect.anything());
  });

  // Verify that a dummy thumbnail image is displayed if there is no thumbnail image
  it("should use dummy thumbnail when thumbnail_path is missing", () => {
    const bookWithoutThumbnail = createMockBookWithState({ ...mockBook, thumbnail_path: null });

    renderBookCard({ ...defaultProps, books: [bookWithoutThumbnail] });

    const img = screen.getByAltText("Test Book");
    // In Vitest/jsdom, imported SVGs might be converted to base64 Data URLs
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("should return null if book is not found at index", () => {
    const { container } = renderBookCard({ ...defaultProps, books: [] });
    expect(container.firstChild).toBeNull();
  });

  it("should handle zero total_pages correctly in progress bar", () => {
    const bookWithZeroPages = createMockBookWithState({ ...mockBook, total_pages: 0 });
    renderBookCard({ ...defaultProps, books: [bookWithZeroPages] });

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });

  it("should handle missing tags correctly", () => {
    const bookWithoutTags = createMockBookWithState({ ...mockBook, tag_ids_str: null });
    renderBookCard({ ...defaultProps, books: [bookWithoutTags], tags: [] });

    expect(screen.queryByRole("chip")).not.toBeInTheDocument();
  });

  // New Test: Check if selected visual indicator is displayed
  it("should display a checkmark and outline when selected", () => {
    const selectionContext = {
      ...defaultSelectionContext,
      selectedBookIds: new Set([mockBook.id]),
    };
    renderBookCard(defaultProps, selectionContext);

    // Check if CheckCircle icon is rendered (it has data-testid="CheckCircleIcon" by MUI)
    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
  });

  // New Test: Check if visual indicator is NOT displayed when not selected
  it("should not display a checkmark when not selected", () => {
    renderBookCard();

    expect(screen.queryByTestId("CheckCircleIcon")).not.toBeInTheDocument();
  });
});
