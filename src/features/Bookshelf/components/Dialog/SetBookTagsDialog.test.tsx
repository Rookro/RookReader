import { error as logError } from "@tauri-apps/plugin-log";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../../../bindings/BookCommands";
import type { Tag } from "../../../../domain/tag/schema";
import { renderWithProviders } from "../../../../test/utils";
import SetBookTagsDialog from "./SetBookTagsDialog";

// Mock BookCommands
describe("SetBookTagsDialog", () => {
  const user = userEvent.setup();

  const mockTags: Tag[] = [
    { id: 1, name: "Tag 1", color_code: "#ff0000" },
    { id: 2, name: "Tag 2", color_code: "#00ff00" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch current tags on open", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([1]);

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );

    expect(BookCommands.getBookTags).toHaveBeenCalledWith(123);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked(); // Tag 1 (id: 1) should be checked
      expect(checkboxes[1]).not.toBeChecked(); // Tag 2 (id: 2) should not be checked
    });
  });

  it("should toggle selections and call updateBookTags on OK", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
    const onUpdateTags = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={mockTags}
        onClose={onClose}
        onUpdateTags={onUpdateTags}
      />,
    );

    await waitFor(() => expect(screen.getByText("Tag 1")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // Toggle Tag 2

    // ok-button is usually translated to "ok"
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(123, [2]);
      expect(onUpdateTags).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("should show 'no tags available' message when availableTags is empty", () => {
    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={[]}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );
    expect(screen.getByText(/No tags available/i)).toBeInTheDocument();
  });

  it("should log error if fetchBookTags fails", async () => {
    vi.mocked(BookCommands.getBookTags).mockRejectedValue(new Error("Fetch failed"));

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch book tags"));
    });
  });

  it("should log error if updateBookTags fails", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
    vi.mocked(BookCommands.updateBookTags).mockRejectedValue(new Error("Update failed"));

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Tag 1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to update book tags"));
    });
  });

  it("surfaces a save failure with a notification, refetches, and keeps the dialog open", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
    vi.mocked(BookCommands.updateBookTags).mockRejectedValue(new Error("Update failed"));
    const onUpdateTags = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={mockTags}
        onClose={onClose}
        onUpdateTags={onUpdateTags}
      />,
    );

    await waitFor(() => expect(screen.getByText("Tag 1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /ok/i }));

    // An error notification appears, the refetch callback runs (so partial success
    // is reflected), and the dialog stays open for retry.
    await waitFor(() => expect(screen.getByText("Tag operation failed.")).toBeInTheDocument());
    expect(onUpdateTags).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores a late tag fetch after reopening for another book", async () => {
    let resolveA: (v: number[]) => void = () => {};
    const aPromise = new Promise<number[]>((res) => {
      resolveA = res;
    });
    vi.mocked(BookCommands.getBookTags)
      .mockReturnValueOnce(aPromise) // book 1: slow
      .mockResolvedValueOnce([]); // book 2: fast, no tags

    const { rerender } = renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[1]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );

    // Reopen for book 2 before book 1's fetch resolves.
    rerender(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[2]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );
    await waitFor(() => expect(BookCommands.getBookTags).toHaveBeenCalledWith(2));

    // Book 1's fetch resolves late with tag 1 selected: it must not be applied.
    resolveA([1]);
    await Promise.resolve();

    expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();
  });

  it("clears the prior selection when a reopened fetch fails", async () => {
    vi.mocked(BookCommands.getBookTags)
      .mockResolvedValueOnce([1]) // book 1: tag 1 selected
      .mockRejectedValueOnce(new Error("boom")); // book 2: fetch fails

    const { rerender } = renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[1]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());

    rerender(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[2]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );

    // Book 2's fetch failed: the checkboxes reset instead of keeping book 1's tag.
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked());
  });

  it("should do nothing if handleSave is called while bookIds is empty", async () => {
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
    const onUpdateTags = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={onUpdateTags}
      />,
    );

    // ok button is still there but logic should return early
    await user.click(screen.getByRole("button", { name: /ok/i }));
    expect(BookCommands.updateBookTags).not.toHaveBeenCalled();
    expect(onUpdateTags).not.toHaveBeenCalled();
  });

  it("should untoggle an already selected tag", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([1]);
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookIds={[123]}
        availableTags={mockTags}
        onClose={vi.fn()}
        onUpdateTags={vi.fn()}
      />,
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes[0]).toBeChecked();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]); // Untoggle Tag 1

    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(123, []);
    });
  });
});
