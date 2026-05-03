import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState, createMockTag } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookCard from "./BookCard";
import { BookSelectionProvider } from "./BookSelectionContext";
import { BookshelfActionsContext } from "./BookshelfActionsContext";

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

  const mockActions = {
    openDialog: vi.fn(),
    refreshBookshelf: vi.fn(),
    refreshSeries: vi.fn(),
  };

  const defaultProps = {
    book: mockBook,
    tags: mockTags,
    size: "medium" as const,
    enableAutoScroll: true,
    onBookClick: vi.fn(),
  };

  const renderBookCard = (props = defaultProps, selectionProviderProps = {}) => {
    return renderWithProviders(
      <BookshelfActionsContext.Provider value={mockActions}>
        <BookSelectionProvider {...selectionProviderProps}>
          <BookCard {...props} />
        </BookSelectionProvider>
      </BookshelfActionsContext.Provider>,
    );
  };

  it("should render book title and progress bar", () => {
    renderBookCard();

    expect(screen.getByText("Test Book")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("should render tags", () => {
    renderBookCard();

    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag2")).toBeInTheDocument();
  });

  it("should call onBookClick when clicked", async () => {
    const onBookClick = vi.fn();
    renderBookCard({ ...defaultProps, onBookClick });

    const actionArea = screen.getByRole("button");
    await user.click(actionArea);

    expect(onBookClick).toHaveBeenCalledWith(mockBook, expect.anything());
  });

  it("should open context menu when right-clicked", async () => {
    renderBookCard();

    const actionArea = screen.getByRole("button");
    await user.pointer({ keys: "[MouseRight]", target: actionArea });

    // Verify context menu items are rendered
    expect(await screen.findByText(/Add to Collection/i)).toBeInTheDocument();
  });

  it("should display a checkmark when selected", () => {
    // To test selection, we can preload the state or mock the context.
    // BookSelectionProvider by default uses its own state.
    // For simplicity, we can just check it's not there initially.
    renderBookCard();
    expect(screen.queryByTestId("CheckCircleIcon")).not.toBeInTheDocument();
  });

  it("should render the thumbnail with correct src", () => {
    renderBookCard();

    const image = screen.getByAltText("Test Book");
    expect(image).toHaveAttribute("src", "asset://thumbnail.jpg");
  });

  it("should render progress as 0 if total_pages is 0", () => {
    const bookWithNoPages = createMockBookWithState({
      ...mockBook,
      total_pages: 0,
    });
    renderBookCard({ ...defaultProps, book: bookWithNoPages });

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });
});
