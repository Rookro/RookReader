import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/utils";
import SetBookTagsDialog from "./SetBookTagsDialog";
import * as BookCommands from "../../../bindings/BookCommands";
import { Tag } from "../../../types/DatabaseModels";
import { error as logError } from "@tauri-apps/plugin-log";

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
        bookId={123}
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
        bookId={123}
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
        bookId={123}
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
        bookId={123}
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
        bookId={123}
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

  it("should do nothing if handleSave is called while bookId is null", async () => {
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
    const onUpdateTags = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog
        openDialog={true}
        bookId={null}
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
        bookId={123}
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
