import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockTag } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookCard from "./BookCard";

describe("BookCard", () => {
  const user = userEvent.setup();

  const mockBook = createMockBookWithState({
    id: 1,
    display_name: "Test Book",
    total_pages: 100,
    last_read_page_index: 50,
    thumbnail_path: "thumbnail.jpg",
    tag_ids_str: "1,2",
  });

  const mockTags = [
    createMockTag({ id: 1, name: "Tag1", color_code: "#ff0000" }),
    createMockTag({ id: 2, name: "Tag2", color_code: "#00ff00" }),
  ];

  const defaultProps = {
    books: [mockBook],
    tags: mockTags,
    columnCount: 1,
    columnIndex: 0,
    rowIndex: 0,
    size: "medium" as const,
    style: {},
    data: {
      books: [mockBook],
      tags: mockTags,
      size: "medium" as const,
      columnCount: 1,
      onBookSelect: vi.fn(),
      onBookContextMenu: vi.fn(),
    },
    index: 0,
    isScrolling: false,
    ariaAttributes: {
      "aria-colindex": 1,
      role: "gridcell" as const,
    },
  };

  // Verify that the book title and reading progress bar are displayed correctly
  it("should render book title and progress bar", () => {
    renderWithProviders(<BookCard {...defaultProps} />);

    expect(screen.getByText("Test Book")).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  // Verify that the tags associated with the book are displayed correctly
  it("should render tags", () => {
    renderWithProviders(<BookCard {...defaultProps} />);

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
  });

  // Verify that onBookSelect callback is called correctly when the card is clicked
  it("should call onBookSelect when clicked", async () => {
    const onBookSelect = vi.fn();
    renderWithProviders(<BookCard {...defaultProps} onBookSelect={onBookSelect} />);

    const actionArea = screen.getByRole("button");
    await user.click(actionArea);

    expect(onBookSelect).toHaveBeenCalledWith(mockBook);
  });

  // Verify that the callback for displaying the context menu is called correctly when the card is right-clicked
  it("should call onBookContextMenu when right clicked", async () => {
    const onBookContextMenu = vi.fn();
    renderWithProviders(<BookCard {...defaultProps} onBookContextMenu={onBookContextMenu} />);

    const actionArea = screen.getByRole("button");
    await user.pointer({ keys: "[MouseRight]", target: actionArea });

    expect(onBookContextMenu).toHaveBeenCalledWith(mockBook, expect.anything());
  });

  // Verify that a dummy thumbnail image is displayed if there is no thumbnail image
  it("should use dummy thumbnail when thumbnail_path is missing", () => {
    const bookWithoutThumbnail = createMockBookWithState({ ...mockBook, thumbnail_path: null });

    renderWithProviders(<BookCard {...defaultProps} books={[bookWithoutThumbnail]} />);

    const img = screen.getByAltText("Test Book");
    // In Vitest/jsdom, imported SVGs might be converted to base64 Data URLs
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("should return null if book is not found at index", () => {
    const { container } = renderWithProviders(<BookCard {...defaultProps} books={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should handle zero total_pages correctly in progress bar", () => {
    const bookWithZeroPages = createMockBookWithState({ ...mockBook, total_pages: 0 });
    renderWithProviders(<BookCard {...defaultProps} books={[bookWithZeroPages]} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });

  it("should handle missing tags correctly", () => {
    const bookWithoutTags = createMockBookWithState({ ...mockBook, tag_ids_str: null });
    renderWithProviders(<BookCard {...defaultProps} books={[bookWithoutTags]} tags={[]} />);

    expect(screen.queryByRole("chip")).not.toBeInTheDocument();
  });
});
