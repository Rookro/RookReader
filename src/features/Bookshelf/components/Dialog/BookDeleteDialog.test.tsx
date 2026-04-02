import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookDeleteDialog from "./BookDeleteDialog";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import i18n from "../../../../i18n/config";
import * as BookCollectionReducer from "../../slice";
import { createMockBookWithState, createMockBookshelf } from "../../../../test/factories";

vi.mock("../../slice", async (importOriginal) => {
  const actual = await importOriginal<typeof BookCollectionReducer>();
  return {
    ...actual,
    deleteBookFromCollection: vi.fn(() => ({ type: "mock/deleteBook" })),
  };
});

describe("BookDeleteDialog", () => {
  const user = userEvent.setup();

  const mockBook = createMockBookWithState({
    id: 1,
    display_name: "Test Book",
  });

  const defaultProps = {
    openDialog: true,
    book: mockBook,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that the delete dialog is rendered correctly and includes the book name
  it("should render correctly and show book name", () => {
    renderWithProviders(<BookDeleteDialog {...defaultProps} />);
    expect(screen.getByText(i18n.t("bookshelf.book-deletion.title"))).toBeInTheDocument();
    expect(screen.getByText(/Test Book/)).toBeInTheDocument();
  });

  // Verify that the delete action is dispatched and the dialog closes when the delete button is clicked
  it("should call delete thunk and onClose when delete button is clicked", async () => {
    const onClose = vi.fn();
    renderWithProviders(<BookDeleteDialog {...defaultProps} onClose={onClose} />);

    const deleteButton = screen.getByText(i18n.t("bookshelf.book-deletion.delete-button"));
    await user.click(deleteButton);

    await waitFor(() => {
      expect(BookCollectionReducer.deleteBookFromCollection).toHaveBeenCalledWith({
        bookId: mockBook.id,
        bookshelfId: null,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  // Verify that the dialog closes when the cancel button is clicked
  it("should call onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    renderWithProviders(<BookDeleteDialog {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByText(i18n.t("bookshelf.book-deletion.cancel-button"));
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  // Verify that the bookshelf name is correctly displayed when a bookshelf is selected
  it("should handle bookshelfName fallback when bookshelf is selected", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.bookCollection.bookshelf.bookshelves = [
      createMockBookshelf({ id: 1, name: "Shelf 1" }),
    ];
    preloadedState.bookCollection.bookshelf.selectedId = 1;
    preloadedState.bookCollection.bookshelf.books = [];
    preloadedState.bookCollection.bookshelf.status = "idle";
    preloadedState.bookCollection.bookshelf.error = null;

    renderWithProviders(<BookDeleteDialog {...defaultProps} />, { preloadedState });
    expect(screen.getByText(/Shelf 1/)).toBeInTheDocument();
  });

  // Verify that the deletion process is not executed and the dialog closes if book info is null
  it("should not call delete if book is null (edge case)", async () => {
    const onClose = vi.fn();
    renderWithProviders(<BookDeleteDialog {...defaultProps} book={null} onClose={onClose} />);

    const deleteButton = screen.getByText(i18n.t("bookshelf.book-deletion.delete-button"));
    await user.click(deleteButton);

    await waitFor(() => {
      expect(BookCollectionReducer.deleteBookFromCollection).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
