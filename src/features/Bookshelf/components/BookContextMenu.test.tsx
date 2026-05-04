import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookContextMenu, { type BookContextMenuProps } from "./BookContextMenu";
import { BookshelfActionsContext } from "./BookshelfActionsContext";

describe("BookContextMenu", () => {
  const user = userEvent.setup();
  const mockBook = createMockBookWithState({ id: 1, display_name: "Test Book" });

  const mockActions = {
    openDialog: vi.fn(),
    refreshBookshelf: vi.fn(),
    refreshSeries: vi.fn(),
  };

  const defaultProps: BookContextMenuProps = {
    book: mockBook,
    anchor: { mouseX: 100, mouseY: 100 },
    onClose: vi.fn(),
  };

  const renderBookContextMenu = (props = defaultProps) => {
    return renderWithProviders(
      <BookshelfActionsContext.Provider value={mockActions}>
        <BookContextMenu {...props} />
      </BookshelfActionsContext.Provider>,
    );
  };

  it("should render menu items when anchor is provided", () => {
    renderBookContextMenu();

    expect(screen.getByText(/Add to Collection/i)).toBeInTheDocument();
    expect(screen.getByText(/Set Series/i)).toBeInTheDocument();
    expect(screen.getByText(/Set tags/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove book/i)).toBeInTheDocument();
  });

  it("should call callbacks and onClose when items are clicked", async () => {
    renderBookContextMenu();

    await user.click(screen.getByText(/Add to Collection/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("add-to-bookshelf", [mockBook]);
    expect(defaultProps.onClose).toHaveBeenCalled();

    await user.click(screen.getByText(/Set Series/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("set-series", [mockBook]);

    await user.click(screen.getByText(/Set tags/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("set-tags", [mockBook]);

    await user.click(screen.getByText(/Remove book/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("delete-books", [mockBook]);
  });

  it("should not render menu when anchor is null", () => {
    renderBookContextMenu({ ...defaultProps, anchor: null });
    expect(screen.queryByText(/Add to Collection/i)).not.toBeInTheDocument();
  });
});
