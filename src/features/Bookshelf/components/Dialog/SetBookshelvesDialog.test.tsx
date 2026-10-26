import { error as logError } from "@tauri-apps/plugin-log";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookshelfCommand from "../../../../bindings/BookshelfCommands";
import type { Bookshelf } from "../../../../domain/bookshelf/schema";
import { renderWithProviders } from "../../../../test/utils";
import SetBookshelvesDialog from "./SetBookshelvesDialog";

describe("SetBookshelvesDialog", () => {
  const user = userEvent.setup();

  const mockBookshelves: Bookshelf[] = [
    { id: 1, name: "Shelf 1", icon_id: "library_books", created_at: "2026-03-01T10:00:00" },
    { id: 2, name: "Shelf 2", icon_id: "library_books", created_at: "2026-03-01T11:00:00" },
    { id: 3, name: "Shelf 3", icon_id: "library_books", created_at: "2026-03-01T12:00:00" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks the bookshelves the book is already in", async () => {
    vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([1]);

    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[123]}
        availableBookshelves={mockBookshelves}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Set collections")).toBeInTheDocument();
    expect(BookshelfCommand.getBookshelvesForBook).toHaveBeenCalledWith(123);
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked();
  });

  it("removes the book from a bookshelf that is unchecked", async () => {
    vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([1, 2]);
    vi.mocked(BookshelfCommand.setBookshelvesForBook).mockResolvedValue();
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[123]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(123, [2]);
  });

  // Setting the collections of several books must keep each book's other collections
  it("shows bookshelves holding some of the books as partly checked and keeps them on save", async () => {
    vi.mocked(BookshelfCommand.getBookshelvesForBook).mockImplementation(async (bookId: number) =>
      bookId === 10 ? [1, 2] : [1],
    );
    vi.mocked(BookshelfCommand.setBookshelvesForBook).mockResolvedValue();
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[10, 11]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toHaveAttribute("data-indeterminate", "true");
    expect(checkboxes[2]).not.toBeChecked();

    await user.click(checkboxes[2]);
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(10, [1, 2, 3]);
    expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(11, [1, 3]);
  });

  it("closes without saving when nothing changed", async () => {
    vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([1]);
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[10, 11]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(BookshelfCommand.setBookshelvesForBook).not.toHaveBeenCalled();
  });

  // Saving after a failed read would remove the books from collections the dialog never saw
  it("disables OK when the books' bookshelves could not be read", async () => {
    vi.mocked(BookshelfCommand.getBookshelvesForBook).mockRejectedValue(new Error("boom"));

    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[10]}
        availableBookshelves={mockBookshelves}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch bookshelves for books"),
      ),
    );
    expect(screen.getByRole("button", { name: /ok|決定/i })).toBeDisabled();
  });

  it("should show 'no collections available' message when availableBookshelves is empty", () => {
    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[123]}
        availableBookshelves={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/No collections available/i)).toBeInTheDocument();
  });

  it("records a save failure in the bookshelf slice and keeps the dialog open", async () => {
    vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
    vi.mocked(BookshelfCommand.setBookshelvesForBook).mockRejectedValue(new Error("Set failed"));
    const onClose = vi.fn();

    const { store } = renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[123]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ok|決定/i })).not.toBeDisabled(),
    );
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    // The slice error is what GlobalErrorListener turns into the notification;
    // the dialog stays open for retry.
    await waitFor(() => expect(store.getState().bookCollection.error).not.toBeNull());
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to set bookshelves for books"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should just close if no book is passed and ok is clicked somehow", async () => {
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookshelvesDialog
        open={true}
        bookIds={[]}
        availableBookshelves={mockBookshelves}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    expect(BookshelfCommand.setBookshelvesForBook).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
