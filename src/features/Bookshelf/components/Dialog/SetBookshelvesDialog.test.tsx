import { error as logError } from "@tauri-apps/plugin-log";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookshelfCommand from "../../../../bindings/BookshelfCommands";
import type { Bookshelf } from "../../../../domain/bookshelf/schema";
import { createMockBookshelf } from "../../../../test/factories";
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

  describe("creating a collection", () => {
    const newBookshelf = createMockBookshelf({ id: 4, name: "New Shelf", icon_id: "book" });

    // The button stays disabled until the books' collections are loaded.
    const clickNewCollection = async () => {
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "New collection" })).toBeEnabled(),
      );
      await user.click(screen.getByRole("button", { name: "New collection" }));
    };

    const createBookshelfFromDialog = async () => {
      await clickNewCollection();
      await user.type(screen.getByLabelText("Collection name"), "New Shelf");
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() =>
        expect(screen.queryByText("Create a Collection")).not.toBeInTheDocument(),
      );
    };

    it("opens the create-collection dialog from the create button", async () => {
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
      renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={vi.fn()}
        />,
      );

      await clickNewCollection();

      expect(screen.getByText("Create a Collection")).toBeInTheDocument();
    });

    // A collection checked before the load finishes would be reset by it
    it("disables the create button until the books' collections are loaded", async () => {
      let resolveLoad: (ids: number[]) => void = () => {};
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockReturnValue(
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
      );

      renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "New collection" })).toBeDisabled();
      await act(async () => resolveLoad([]));
      expect(screen.getByRole("button", { name: "New collection" })).toBeEnabled();
    });

    it("adds every book to the created collection when OK is pressed before the list refresh", async () => {
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
      vi.mocked(BookshelfCommand.createBookshelf).mockResolvedValue(newBookshelf);
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

      await createBookshelfFromDialog();
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(10, [4]);
      expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(11, [4]);
    });

    it("ignores a creation that finishes after the dialog reopened for other books", async () => {
      let resolveCreate: (bookshelf: Bookshelf) => void = () => {};
      vi.mocked(BookshelfCommand.createBookshelf).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
      const onClose = vi.fn();
      const otherBookIds = [20];

      const { rerender } = renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );
      await createBookshelfFromDialog();

      // Cancel and reopen for another book while the creation is still pending.
      rerender(
        <SetBookshelvesDialog
          open={false}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );
      rerender(
        <SetBookshelvesDialog
          open={true}
          bookIds={otherBookIds}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );
      await waitFor(() => expect(BookshelfCommand.getBookshelvesForBook).toHaveBeenCalledWith(20));
      await waitFor(() => expect(screen.getByRole("button", { name: /ok|決定/i })).toBeEnabled());
      await act(async () => resolveCreate(newBookshelf));
      rerender(
        <SetBookshelvesDialog
          open={true}
          bookIds={otherBookIds}
          availableBookshelves={[...mockBookshelves, newBookshelf]}
          onClose={onClose}
        />,
      );

      expect(screen.getAllByRole("checkbox")[3]).not.toBeChecked();
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookshelfCommand.setBookshelvesForBook).not.toHaveBeenCalled();
    });

    it("closes only the create-collection dialog on Escape or a backdrop click", async () => {
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
      const onClose = vi.fn();

      renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );

      await clickNewCollection();
      await user.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.queryByText("Create a Collection")).not.toBeInTheDocument(),
      );

      await clickNewCollection();
      const createDialog = screen.getByRole("dialog", { name: "Create a Collection" });
      // MUI closes a dialog on a click on its container, around the paper.
      await user.click(createDialog.parentElement as HTMLElement);
      await waitFor(() =>
        expect(screen.queryByText("Create a Collection")).not.toBeInTheDocument(),
      );

      expect(screen.getByText("Set collections")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("checks the created collection and adds every book to it on OK", async () => {
      // Stable like the app's `dialogBookIds`; a new array would reload the check states.
      const bookIds = [10, 11];
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockImplementation(
        async (bookId: number) => (bookId === 10 ? [1] : []),
      );
      vi.mocked(BookshelfCommand.createBookshelf).mockResolvedValue(newBookshelf);
      vi.mocked(BookshelfCommand.setBookshelvesForBook).mockResolvedValue();
      const onClose = vi.fn();

      const { rerender } = renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={bookIds}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );
      await waitFor(() =>
        expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true"),
      );

      await createBookshelfFromDialog();
      expect(BookshelfCommand.createBookshelf).toHaveBeenCalledWith("New Shelf", "book");

      // The backend's `bookshelves-changed` refetch brings the new collection into the list.
      rerender(
        <SetBookshelvesDialog
          open={true}
          bookIds={bookIds}
          availableBookshelves={[...mockBookshelves, newBookshelf]}
          onClose={onClose}
        />,
      );
      await waitFor(() => expect(screen.getAllByRole("checkbox")[3]).toBeChecked());

      await user.click(screen.getByRole("button", { name: /ok|決定/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(10, [1, 4]);
      expect(BookshelfCommand.setBookshelvesForBook).toHaveBeenCalledWith(11, [4]);
    });

    it("changes nothing when the create-collection dialog is cancelled", async () => {
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
      const onClose = vi.fn();

      renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /ok|決定/i })).not.toBeDisabled(),
      );

      await clickNewCollection();
      await user.type(screen.getByLabelText("Collection name"), "New Shelf");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        expect(screen.queryByText("Create a Collection")).not.toBeInTheDocument(),
      );

      expect(BookshelfCommand.createBookshelf).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookshelfCommand.setBookshelvesForBook).not.toHaveBeenCalled();
    });

    it("records a failed creation in the bookshelf slice and checks nothing", async () => {
      vi.mocked(BookshelfCommand.getBookshelvesForBook).mockResolvedValue([]);
      vi.mocked(BookshelfCommand.createBookshelf).mockRejectedValue(new Error("Duplicate"));
      const onClose = vi.fn();

      const { store } = renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={mockBookshelves}
          onClose={onClose}
        />,
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /ok|決定/i })).not.toBeDisabled(),
      );

      await createBookshelfFromDialog();

      await waitFor(() => expect(store.getState().bookCollection.error).not.toBeNull());
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookshelfCommand.setBookshelvesForBook).not.toHaveBeenCalled();
    });

    it("shows the create button when there are no collections", () => {
      renderWithProviders(
        <SetBookshelvesDialog
          open={true}
          bookIds={[10]}
          availableBookshelves={[]}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText(/No collections available/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New collection" })).toBeInTheDocument();
    });
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
