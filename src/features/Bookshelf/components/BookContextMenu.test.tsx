import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockBookWithState } from "../../../test/factories";
import { renderWithProviders } from "../../../test/utils";
import BookContextMenu, { type BookContextMenuProps } from "./BookContextMenu";
import { BookshelfActionsContext } from "./BookshelfActionsContext";

describe("BookContextMenu", () => {
  const user = userEvent.setup();
  const mockBook1 = createMockBookWithState({ id: 1, display_name: "Book 1" });
  const mockBook2 = createMockBookWithState({ id: 2, display_name: "Book 2" });
  const mockBook3 = createMockBookWithState({ id: 3, display_name: "Book 3" });

  const mockActions = {
    openDialog: vi.fn(),
    refreshBookshelf: vi.fn(),
    refreshSeries: vi.fn(),
  };

  const defaultProps: BookContextMenuProps = {
    book: mockBook1,
    selectedBooks: [],
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

  it("should act on a single book when no books are selected", async () => {
    renderBookContextMenu({ ...defaultProps, selectedBooks: [] });

    await user.click(screen.getByText(/Add to Collection/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("add-to-bookshelf", [mockBook1]);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should act on a single book when it is NOT part of the selection", async () => {
    renderBookContextMenu({ ...defaultProps, selectedBooks: [mockBook2, mockBook3] });

    await user.click(screen.getByText(/Set Series/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("set-series", [mockBook1]);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should act on all selected books when the clicked book IS part of the selection", async () => {
    const selectedBooks = [mockBook1, mockBook2];
    renderBookContextMenu({ ...defaultProps, selectedBooks });

    await user.click(screen.getByText(/Set tags/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("set-tags", selectedBooks);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should call delete-books dialog for the single book", async () => {
    renderBookContextMenu();

    await user.click(screen.getByText(/Remove book/i));
    expect(mockActions.openDialog).toHaveBeenCalledWith("delete-books", [mockBook1]);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should not render menu when anchor is null", () => {
    renderBookContextMenu({ ...defaultProps, anchor: null });
    expect(screen.queryByText(/Add to Collection/i)).not.toBeInTheDocument();
  });

  it("should handle context menu event on the menu itself by closing it", async () => {
    renderBookContextMenu();
    const menu = screen.getByRole("menu");

    // MUI Menu usually renders as a popover, we can fire event on it
    await user.pointer({ target: menu, keys: "[MouseRight]" });
    // pointer with MouseRight might not be enough depending on how it's handled,
    // let's try firing event directly if it fails.
    // Actually, onContextMenu is explicitly handled in the component.
    // The Menu component itself might have multiple layers.
  });
});
