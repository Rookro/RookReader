import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookAdditionToBookshelfDialog from "./BookAdditionToBookshelfDialog";
import { renderWithProviders } from "../../../test/utils";
import i18n from "../../../i18n/config";
import { open } from "@tauri-apps/plugin-dialog";
import { useDragDropEvent } from "../../../hooks/useDragDropEvent";
import { error } from "@tauri-apps/plugin-log";

vi.mock("../../../hooks/useDragDropEvent", () => ({
  useDragDropEvent: vi.fn(),
}));

describe("BookAdditionToBookshelfDialog", () => {
  const user = userEvent.setup();
  const onAddBooks = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that the dialog is not visible when openDialog is false
  it("should not be visible when openDialog is false", () => {
    renderWithProviders(
      <BookAdditionToBookshelfDialog
        openDialog={false}
        onAddBooks={onAddBooks}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText(i18n.t("bookshelf.book-addition.title"))).not.toBeInTheDocument();
  });

  // Verify that the dialog is visible when openDialog is true
  it("should be visible when openDialog is true", () => {
    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );
    expect(screen.getByText(i18n.t("bookshelf.book-addition.title"))).toBeInTheDocument();
  });

  // Verify that onAddBooks is called when files are selected and OK is clicked
  it("should call onAddBooks when files are selected and OK is clicked", async () => {
    vi.mocked(open).mockResolvedValue(["/path/to/book1.epub", "/path/to/book2.zip"]);

    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );

    const selectButton = screen.getByText(i18n.t("bookshelf.book-addition.select-file"));
    await user.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText("book1.epub")).toBeInTheDocument();
      expect(screen.getByText("book2.zip")).toBeInTheDocument();
    });

    const okButton = screen.getByText(i18n.t("bookshelf.book-addition.ok-button"));
    await user.click(okButton);

    expect(onAddBooks).toHaveBeenCalledWith(["/path/to/book1.epub", "/path/to/book2.zip"]);
    expect(onClose).toHaveBeenCalled();
  });

  // Verify that selected files can be removed from the list
  it("should allow removing selected files", async () => {
    vi.mocked(open).mockResolvedValue(["/path/to/book1.epub"]);

    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );

    const selectButton = screen.getByText(i18n.t("bookshelf.book-addition.select-file"));
    await user.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText("book1.epub")).toBeInTheDocument();
    });

    const removeButton = screen.getByRole("button", { name: /delete/i });
    await user.click(removeButton);

    expect(screen.queryByText("book1.epub")).not.toBeInTheDocument();
  });

  // Verify that onClose is called when the cancel button is clicked
  it("should call onClose when cancel is clicked", async () => {
    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );

    const cancelButton = screen.getByText(i18n.t("bookshelf.book-addition.cancel-button"));
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  // Verify that drag and drop events are correctly handled
  it("should handle drag and drop events", async () => {
    let capturedCallbacks: Parameters<typeof useDragDropEvent>[0] | undefined;
    vi.mocked(useDragDropEvent).mockImplementation((c) => {
      capturedCallbacks = c;
    });

    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );

    // Simulate drag enter
    capturedCallbacks?.onDrag?.();
    // Simulate drop
    capturedCallbacks?.onDrop?.(["/dragged/book.epub"]);

    await waitFor(() => {
      expect(screen.getByText("book.epub")).toBeInTheDocument();
    });
  });

  // Verify that an error log is output if opening the file selection dialog fails
  it("should log error if open dialog fails", async () => {
    vi.mocked(open).mockRejectedValue(new Error("Open failed"));

    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );

    const selectButton = screen.getByText(i18n.t("bookshelf.book-addition.select-file"));
    await user.click(selectButton);

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to open the file selection dialog"),
      );
    });
  });

  // Verify that single file selection is handled correctly
  it("should handle single file selection", async () => {
    vi.mocked(open).mockResolvedValue("/path/to/single.epub");

    renderWithProviders(
      <BookAdditionToBookshelfDialog openDialog={true} onAddBooks={onAddBooks} onClose={onClose} />,
    );

    const selectButton = screen.getByText(i18n.t("bookshelf.book-addition.select-file"));
    await user.click(selectButton);

    await waitFor(() => {
      expect(screen.getByText("single.epub")).toBeInTheDocument();
    });
  });
});
