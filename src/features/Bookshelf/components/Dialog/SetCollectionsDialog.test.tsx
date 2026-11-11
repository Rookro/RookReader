import { error as logError } from "@tauri-apps/plugin-log";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../bindings/api";
import type { Collection } from "../../../../domain/entities";
import { createMockCollection } from "../../../../test/factories";
import { renderWithProviders } from "../../../../test/utils";
import { ErrorCode } from "../../../../types/Error";
import SetCollectionsDialog from "./SetCollectionsDialog";

describe("SetCollectionsDialog", () => {
  const user = userEvent.setup();

  const mockCollections: Collection[] = [
    { id: 1, name: "Shelf 1", iconId: "library_books", createdAt: "2026-03-01T10:00:00Z" },
    { id: 2, name: "Shelf 2", iconId: "library_books", createdAt: "2026-03-01T11:00:00Z" },
    { id: 3, name: "Shelf 3", iconId: "library_books", createdAt: "2026-03-01T12:00:00Z" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks the collections the book is already in", async () => {
    vi.mocked(api.getCollectionsForBook).mockResolvedValue([1]);

    renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[123]}
        availableCollections={mockCollections}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Set collections")).toBeInTheDocument();
    expect(api.getCollectionsForBook).toHaveBeenCalledWith(123);
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked();
  });

  it("removes the book from a collection that is unchecked", async () => {
    vi.mocked(api.getCollectionsForBook).mockResolvedValue([1, 2]);
    vi.mocked(api.setCollectionsForBook).mockResolvedValue(null);
    const onClose = vi.fn();

    renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[123]}
        availableCollections={mockCollections}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.setCollectionsForBook).toHaveBeenCalledWith(123, [2]);
  });

  // Setting the collections of several books must keep each book's other collections
  it("shows collections holding some of the books as partly checked and keeps them on save", async () => {
    vi.mocked(api.getCollectionsForBook).mockImplementation(async (bookId: number) =>
      bookId === 10 ? [1, 2] : [1],
    );
    vi.mocked(api.setCollectionsForBook).mockResolvedValue(null);
    const onClose = vi.fn();

    renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[10, 11]}
        availableCollections={mockCollections}
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
    expect(api.setCollectionsForBook).toHaveBeenCalledWith(10, [1, 2, 3]);
    expect(api.setCollectionsForBook).toHaveBeenCalledWith(11, [1, 3]);
  });

  it("closes without saving when nothing changed", async () => {
    vi.mocked(api.getCollectionsForBook).mockResolvedValue([1]);
    const onClose = vi.fn();

    renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[10, 11]}
        availableCollections={mockCollections}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.setCollectionsForBook).not.toHaveBeenCalled();
  });

  // Saving after a failed read would remove the books from collections the dialog never saw
  it("disables OK when the books' collections could not be read", async () => {
    vi.mocked(api.getCollectionsForBook).mockRejectedValue(new Error("boom"));

    renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[10]}
        availableCollections={mockCollections}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch collections for books"),
      ),
    );
    expect(screen.getByRole("button", { name: /ok|決定/i })).toBeDisabled();
  });

  it("should show 'no collections available' message when availableCollections is empty", () => {
    renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[123]}
        availableCollections={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/No collections available/i)).toBeInTheDocument();
  });

  it("records a save failure in the collection slice and keeps the dialog open", async () => {
    vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
    vi.mocked(api.setCollectionsForBook).mockRejectedValue(new Error("Set failed"));
    const onClose = vi.fn();

    const { store } = renderWithProviders(
      <SetCollectionsDialog
        open={true}
        bookIds={[123]}
        availableCollections={mockCollections}
        onClose={onClose}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ok|決定/i })).not.toBeDisabled(),
    );
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    // The queued error becomes the notification; the dialog stays open for retry.
    await waitFor(() =>
      expect(store.getState().errorNotification.pending).toEqual([
        { context: "bookshelf", code: ErrorCode.other },
      ]),
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to set collections for books"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("creating a collection", () => {
    const newCollection = createMockCollection({ id: 4, name: "New Shelf", iconId: "book" });

    // The button stays disabled until the books' collections are loaded.
    const clickNewCollection = async () => {
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "New collection" })).toBeEnabled(),
      );
      await user.click(screen.getByRole("button", { name: "New collection" }));
    };

    const createCollectionFromDialog = async () => {
      await clickNewCollection();
      await user.type(screen.getByLabelText("Collection name"), "New Shelf");
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() =>
        expect(screen.queryByText("Create a Collection")).not.toBeInTheDocument(),
      );
    };

    it("opens the create-collection dialog from the create button", async () => {
      vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
      renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={mockCollections}
          onClose={vi.fn()}
        />,
      );

      await clickNewCollection();

      expect(screen.getByText("Create a Collection")).toBeInTheDocument();
    });

    // A collection checked before the load finishes would be reset by it
    it("disables the create button until the books' collections are loaded", async () => {
      let resolveLoad: (ids: number[]) => void = () => {};
      vi.mocked(api.getCollectionsForBook).mockReturnValue(
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
      );

      renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={mockCollections}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByRole("button", { name: "New collection" })).toBeDisabled();
      await act(async () => resolveLoad([]));
      expect(screen.getByRole("button", { name: "New collection" })).toBeEnabled();
    });

    it("adds every book to the created collection when OK is pressed before the list refresh", async () => {
      vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
      vi.mocked(api.createCollection).mockResolvedValue(newCollection);
      vi.mocked(api.setCollectionsForBook).mockResolvedValue(null);
      const onClose = vi.fn();

      renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10, 11]}
          availableCollections={mockCollections}
          onClose={onClose}
        />,
      );

      await createCollectionFromDialog();
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(api.setCollectionsForBook).toHaveBeenCalledWith(10, [4]);
      expect(api.setCollectionsForBook).toHaveBeenCalledWith(11, [4]);
    });

    it("ignores a creation that finishes after the dialog reopened for other books", async () => {
      let resolveCreate: (collection: Collection) => void = () => {};
      vi.mocked(api.createCollection).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );
      vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
      const onClose = vi.fn();
      const otherBookIds = [20];

      const { rerender } = renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={mockCollections}
          onClose={onClose}
        />,
      );
      await createCollectionFromDialog();

      // Cancel and reopen for another book while the creation is still pending.
      rerender(
        <SetCollectionsDialog
          open={false}
          bookIds={[10]}
          availableCollections={mockCollections}
          onClose={onClose}
        />,
      );
      rerender(
        <SetCollectionsDialog
          open={true}
          bookIds={otherBookIds}
          availableCollections={mockCollections}
          onClose={onClose}
        />,
      );
      await waitFor(() => expect(api.getCollectionsForBook).toHaveBeenCalledWith(20));
      await waitFor(() => expect(screen.getByRole("button", { name: /ok|決定/i })).toBeEnabled());
      await act(async () => resolveCreate(newCollection));
      rerender(
        <SetCollectionsDialog
          open={true}
          bookIds={otherBookIds}
          availableCollections={[...mockCollections, newCollection]}
          onClose={onClose}
        />,
      );

      expect(screen.getAllByRole("checkbox")[3]).not.toBeChecked();
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(api.setCollectionsForBook).not.toHaveBeenCalled();
    });

    it("closes only the create-collection dialog on Escape or a backdrop click", async () => {
      vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
      const onClose = vi.fn();

      renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={mockCollections}
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
      vi.mocked(api.getCollectionsForBook).mockImplementation(async (bookId: number) =>
        bookId === 10 ? [1] : [],
      );
      vi.mocked(api.createCollection).mockResolvedValue(newCollection);
      vi.mocked(api.setCollectionsForBook).mockResolvedValue(null);
      const onClose = vi.fn();

      const { rerender } = renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={bookIds}
          availableCollections={mockCollections}
          onClose={onClose}
        />,
      );
      await waitFor(() =>
        expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true"),
      );

      await createCollectionFromDialog();
      expect(api.createCollection).toHaveBeenCalledWith("New Shelf", "book");

      // The backend's `collections-changed` refetch brings the new collection into the list.
      rerender(
        <SetCollectionsDialog
          open={true}
          bookIds={bookIds}
          availableCollections={[...mockCollections, newCollection]}
          onClose={onClose}
        />,
      );
      await waitFor(() => expect(screen.getAllByRole("checkbox")[3]).toBeChecked());

      await user.click(screen.getByRole("button", { name: /ok|決定/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(api.setCollectionsForBook).toHaveBeenCalledWith(10, [1, 4]);
      expect(api.setCollectionsForBook).toHaveBeenCalledWith(11, [4]);
    });

    it("changes nothing when the create-collection dialog is cancelled", async () => {
      vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
      const onClose = vi.fn();

      renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={mockCollections}
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

      expect(api.createCollection).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(api.setCollectionsForBook).not.toHaveBeenCalled();
    });

    it("records a failed creation in the collection slice and checks nothing", async () => {
      vi.mocked(api.getCollectionsForBook).mockResolvedValue([]);
      vi.mocked(api.createCollection).mockRejectedValue(new Error("Duplicate"));
      const onClose = vi.fn();

      const { store } = renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={mockCollections}
          onClose={onClose}
        />,
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /ok|決定/i })).not.toBeDisabled(),
      );

      await createCollectionFromDialog();

      await waitFor(() =>
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "bookshelf", code: ErrorCode.other },
        ]),
      );
      await user.click(screen.getByRole("button", { name: /ok|決定/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(api.setCollectionsForBook).not.toHaveBeenCalled();
    });

    it("shows the create button when there are no collections", () => {
      renderWithProviders(
        <SetCollectionsDialog
          open={true}
          bookIds={[10]}
          availableCollections={[]}
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
      <SetCollectionsDialog
        open={true}
        bookIds={[]}
        availableCollections={mockCollections}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ok|決定/i }));

    expect(api.setCollectionsForBook).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
