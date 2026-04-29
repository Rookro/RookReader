import { error as logError } from "@tauri-apps/plugin-log";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookshelfCommand from "../../../../bindings/BookshelfCommand";
import { renderWithProviders } from "../../../../test/utils";
import type { Bookshelf } from "../../../../types/DatabaseModels";
import AddBooksToBookshelvesDialog from "./AddBooksToBookshelvesDialog";

describe("AddBooksToBookshelvesDialog", () => {
  const user = userEvent.setup();

  const mockBookshelves: Bookshelf[] = [
    { id: 1, name: "Shelf 1", icon_id: "library_books", created_at: "2026-03-01T10:00:00" },
    { id: 2, name: "Shelf 2", icon_id: "library_books", created_at: "2026-03-01T11:00:00" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display available bookshelves and start empty", async () => {
    renderWithProviders(
      <AddBooksToBookshelvesDialog
        openDialog={true}
        bookIds={[123]}
        availableBookshelves={mockBookshelves}
        onClose={vi.fn()}
        onAddBooks={vi.fn()}
      />,
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(screen.getByText("Shelf 1")).toBeInTheDocument();
      expect(screen.getByText("Shelf 2")).toBeInTheDocument();
    });
  });

  it("should toggle selections and call addBookToBookshelf on OK", async () => {
    vi.mocked(BookshelfCommand.addBookToBookshelf).mockResolvedValue();
    const onAddBooks = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <AddBooksToBookshelvesDialog
        openDialog={true}
        bookIds={[123, 456]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
        onAddBooks={onAddBooks}
      />,
    );

    await waitFor(() => expect(screen.getByText("Shelf 1")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // Toggle Shelf 2

    const okButton = screen.getByRole("button", { name: /ok|決定/i });
    expect(okButton).not.toBeDisabled();
    await user.click(okButton);

    await waitFor(() => {
      // 2 books * 1 shelf = 2 calls
      expect(BookshelfCommand.addBookToBookshelf).toHaveBeenCalledTimes(2);
      expect(BookshelfCommand.addBookToBookshelf).toHaveBeenCalledWith(2, 123);
      expect(BookshelfCommand.addBookToBookshelf).toHaveBeenCalledWith(2, 456);
      expect(onAddBooks).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("should show 'no collections available' message when availableBookshelves is empty", () => {
    renderWithProviders(
      <AddBooksToBookshelvesDialog
        openDialog={true}
        bookIds={[123]}
        availableBookshelves={[]}
        onClose={vi.fn()}
        onAddBooks={vi.fn()}
      />,
    );
    expect(screen.getByText(/No collections available/i)).toBeInTheDocument();
  });

  it("should log error if addBookToBookshelf fails", async () => {
    vi.mocked(BookshelfCommand.addBookToBookshelf).mockRejectedValue(new Error("Add failed"));

    renderWithProviders(
      <AddBooksToBookshelvesDialog
        openDialog={true}
        bookIds={[123]}
        availableBookshelves={mockBookshelves}
        onClose={vi.fn()}
        onAddBooks={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Shelf 1")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // Select Shelf 1

    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to add books to bookshelves"),
      );
    });
  });

  it("should just close if no book is passed and ok is clicked somehow", async () => {
    const onClose = vi.fn();
    const onAddBooks = vi.fn();

    renderWithProviders(
      <AddBooksToBookshelvesDialog
        openDialog={true}
        bookIds={[]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
        onAddBooks={onAddBooks}
      />,
    );

    await waitFor(() => expect(screen.getByText("Shelf 1")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // Select Shelf 1

    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    expect(BookshelfCommand.addBookToBookshelf).not.toHaveBeenCalled();
    expect(onAddBooks).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
