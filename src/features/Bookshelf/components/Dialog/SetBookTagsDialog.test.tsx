import { error as logError } from "@tauri-apps/plugin-log";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../../../bindings/BookCommands";
import * as TagCommands from "../../../../bindings/TagCommands";
import type { Tag } from "../../../../domain/tag/schema";
import { createMockTag } from "../../../../test/factories";
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
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={mockTags} onClose={vi.fn()} />,
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
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={mockTags} onClose={onClose} />,
    );

    await waitFor(() => expect(screen.getByText("Tag 1")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // Toggle Tag 2

    // ok-button is usually translated to "ok"
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(123, [2]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("should show 'no tags available' message when availableTags is empty", () => {
    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={[]} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/No tags available/i)).toBeInTheDocument();
  });

  it("should log error if fetchBookTags fails", async () => {
    vi.mocked(BookCommands.getBookTags).mockRejectedValue(new Error("Fetch failed"));

    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={mockTags} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch book tags"));
    });
  });

  it("should log error if updateBookTags fails", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
    vi.mocked(BookCommands.updateBookTags).mockRejectedValue(new Error("Update failed"));

    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={mockTags} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText("Tag 1")).toBeInTheDocument());
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to update book tags"));
    });
  });

  it("records a save failure in the tag slice and keeps the dialog open", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
    vi.mocked(BookCommands.updateBookTags).mockRejectedValue(new Error("Update failed"));
    const onClose = vi.fn();

    const { store } = renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={mockTags} onClose={onClose} />,
    );

    await waitFor(() => expect(screen.getByText("Tag 1")).toBeInTheDocument());
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /ok/i }));

    // The slice error is what GlobalErrorListener turns into the notification;
    // the dialog stays open for retry.
    await waitFor(() => expect(store.getState().tag.error).not.toBeNull());
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
      <SetBookTagsDialog open={true} bookIds={[1]} availableTags={mockTags} onClose={vi.fn()} />,
    );

    // Reopen for book 2 before book 1's fetch resolves.
    rerender(
      <SetBookTagsDialog open={true} bookIds={[2]} availableTags={mockTags} onClose={vi.fn()} />,
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
      <SetBookTagsDialog open={true} bookIds={[1]} availableTags={mockTags} onClose={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());

    rerender(
      <SetBookTagsDialog open={true} bookIds={[2]} availableTags={mockTags} onClose={vi.fn()} />,
    );

    // Book 2's fetch failed: the checkboxes reset instead of keeping book 1's tag.
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked());
  });

  // Tagging several books must keep each book's other tags
  it("shows tags on some of the books as partly checked and keeps them on save", async () => {
    const tags: Tag[] = [...mockTags, { id: 3, name: "Tag 3", color_code: "#0000ff" }];
    vi.mocked(BookCommands.getBookTags).mockImplementation(async (bookId: number) =>
      bookId === 10 ? [1, 2] : [1],
    );
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[10, 11]} availableTags={tags} onClose={onClose} />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toHaveAttribute("data-indeterminate", "true");
    expect(checkboxes[2]).not.toBeChecked();

    await user.click(checkboxes[2]);
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(BookCommands.updateBookTags).toHaveBeenCalledWith(10, [1, 2, 3]);
    expect(BookCommands.updateBookTags).toHaveBeenCalledWith(11, [1, 3]);
  });

  it("closes without saving when nothing changed", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([1]);
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog
        open={true}
        bookIds={[10, 11]}
        availableTags={mockTags}
        onClose={onClose}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("checkbox")[0]).toBeChecked());
    await user.click(screen.getByRole("button", { name: /ok/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(BookCommands.updateBookTags).not.toHaveBeenCalled();
  });

  // Saving after a failed read would overwrite tags the dialog never saw
  it("disables OK when the books' tags could not be read", async () => {
    vi.mocked(BookCommands.getBookTags).mockRejectedValue(new Error("boom"));

    renderWithProviders(
      <SetBookTagsDialog
        open={true}
        bookIds={[10, 11]}
        availableTags={mockTags}
        onClose={vi.fn()}
      />,
    );

    // Disabled while loading too, so check it once the failure has been handled.
    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch book tags")),
    );
    expect(screen.getByRole("button", { name: /ok/i })).toBeDisabled();
  });

  it("should do nothing if handleSave is called while bookIds is empty", async () => {
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
    const onClose = vi.fn();

    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[]} availableTags={mockTags} onClose={onClose} />,
    );

    // ok button is still there but logic should return early
    await user.click(screen.getByRole("button", { name: /ok/i }));
    expect(BookCommands.updateBookTags).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("creating a tag", () => {
    const newTag = createMockTag({ id: 3, name: "New Tag", color_code: "#F44336" });

    // The button stays disabled until the books' tags are loaded.
    const clickNewTag = async () => {
      await waitFor(() => expect(screen.getByRole("button", { name: "New tag" })).toBeEnabled());
      await user.click(screen.getByRole("button", { name: "New tag" }));
    };

    const createTagFromDialog = async () => {
      await clickNewTag();
      await user.type(screen.getByLabelText("Tag name"), "New Tag");
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(screen.queryByText("Create a Tag")).not.toBeInTheDocument());
    };

    it("opens the create-tag dialog from the create button", async () => {
      vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
      renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={mockTags} onClose={vi.fn()} />,
      );

      await clickNewTag();

      expect(screen.getByText("Create a Tag")).toBeInTheDocument();
    });

    // A tag checked before the load finishes would be reset by it
    it("disables the create button until the books' tags are loaded", async () => {
      let resolveLoad: (ids: number[]) => void = () => {};
      vi.mocked(BookCommands.getBookTags).mockReturnValue(
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
      );

      renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={mockTags} onClose={vi.fn()} />,
      );

      expect(screen.getByRole("button", { name: "New tag" })).toBeDisabled();
      await act(async () => resolveLoad([]));
      expect(screen.getByRole("button", { name: "New tag" })).toBeEnabled();
    });

    it("adds the created tag to every book when OK is pressed before the list refresh", async () => {
      vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
      vi.mocked(TagCommands.createTag).mockResolvedValue(newTag);
      vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
      const onClose = vi.fn();

      renderWithProviders(
        <SetBookTagsDialog
          open={true}
          bookIds={[10, 11]}
          availableTags={mockTags}
          onClose={onClose}
        />,
      );

      await createTagFromDialog();
      await user.click(screen.getByRole("button", { name: /ok/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(10, [3]);
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(11, [3]);
    });

    it("ignores a creation that finishes after the dialog reopened for other books", async () => {
      let resolveCreate: (tag: Tag) => void = () => {};
      vi.mocked(TagCommands.createTag).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );
      vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
      const onClose = vi.fn();
      const otherBookIds = [20];

      const { rerender } = renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={mockTags} onClose={onClose} />,
      );
      await createTagFromDialog();

      // Cancel and reopen for another book while the creation is still pending.
      rerender(
        <SetBookTagsDialog
          open={false}
          bookIds={[10]}
          availableTags={mockTags}
          onClose={onClose}
        />,
      );
      rerender(
        <SetBookTagsDialog
          open={true}
          bookIds={otherBookIds}
          availableTags={mockTags}
          onClose={onClose}
        />,
      );
      await waitFor(() => expect(BookCommands.getBookTags).toHaveBeenCalledWith(20));
      await waitFor(() => expect(screen.getByRole("button", { name: /ok/i })).toBeEnabled());
      await act(async () => resolveCreate(newTag));
      rerender(
        <SetBookTagsDialog
          open={true}
          bookIds={otherBookIds}
          availableTags={[...mockTags, newTag]}
          onClose={onClose}
        />,
      );

      expect(screen.getAllByRole("checkbox")[2]).not.toBeChecked();
      await user.click(screen.getByRole("button", { name: /ok/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookCommands.updateBookTags).not.toHaveBeenCalled();
    });

    it("closes only the create-tag dialog on Escape or a backdrop click", async () => {
      vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
      const onClose = vi.fn();

      renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={mockTags} onClose={onClose} />,
      );

      await clickNewTag();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByText("Create a Tag")).not.toBeInTheDocument());

      await clickNewTag();
      const createDialog = screen.getByRole("dialog", { name: "Create a Tag" });
      // MUI closes a dialog on a click on its container, around the paper.
      await user.click(createDialog.parentElement as HTMLElement);
      await waitFor(() => expect(screen.queryByText("Create a Tag")).not.toBeInTheDocument());

      expect(screen.getByText("Set Tags")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("checks the created tag and adds it to every book on OK", async () => {
      // Stable like the app's `dialogBookIds`; a new array would reload the check states.
      const bookIds = [10, 11];
      vi.mocked(BookCommands.getBookTags).mockImplementation(async (bookId: number) =>
        bookId === 10 ? [1] : [],
      );
      vi.mocked(TagCommands.createTag).mockResolvedValue(newTag);
      vi.mocked(BookCommands.updateBookTags).mockResolvedValue();
      const onClose = vi.fn();

      const { rerender } = renderWithProviders(
        <SetBookTagsDialog
          open={true}
          bookIds={bookIds}
          availableTags={mockTags}
          onClose={onClose}
        />,
      );
      await waitFor(() =>
        expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true"),
      );

      await createTagFromDialog();
      expect(TagCommands.createTag).toHaveBeenCalledWith("New Tag", "#F44336");

      // The backend's `tags-changed` refetch brings the new tag into the list.
      rerender(
        <SetBookTagsDialog
          open={true}
          bookIds={bookIds}
          availableTags={[...mockTags, newTag]}
          onClose={onClose}
        />,
      );
      await waitFor(() => expect(screen.getAllByRole("checkbox")[2]).toBeChecked());

      await user.click(screen.getByRole("button", { name: /ok/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(10, [1, 3]);
      expect(BookCommands.updateBookTags).toHaveBeenCalledWith(11, [3]);
    });

    it("changes nothing when the create-tag dialog is cancelled", async () => {
      vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
      const onClose = vi.fn();

      renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={mockTags} onClose={onClose} />,
      );
      await waitFor(() => expect(screen.getByRole("button", { name: /ok/i })).not.toBeDisabled());

      await clickNewTag();
      await user.type(screen.getByLabelText("Tag name"), "New Tag");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByText("Create a Tag")).not.toBeInTheDocument());

      expect(TagCommands.createTag).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /ok/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookCommands.updateBookTags).not.toHaveBeenCalled();
    });

    it("records a failed creation in the tag slice and checks nothing", async () => {
      vi.mocked(BookCommands.getBookTags).mockResolvedValue([]);
      vi.mocked(TagCommands.createTag).mockRejectedValue(new Error("Duplicate"));
      const onClose = vi.fn();

      const { store } = renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={mockTags} onClose={onClose} />,
      );
      await waitFor(() => expect(screen.getByRole("button", { name: /ok/i })).not.toBeDisabled());

      await createTagFromDialog();

      await waitFor(() => expect(store.getState().tag.error).not.toBeNull());
      await user.click(screen.getByRole("button", { name: /ok/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(BookCommands.updateBookTags).not.toHaveBeenCalled();
    });

    it("shows the create button when there are no tags", () => {
      renderWithProviders(
        <SetBookTagsDialog open={true} bookIds={[10]} availableTags={[]} onClose={vi.fn()} />,
      );

      expect(screen.getByText(/No tags available/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New tag" })).toBeInTheDocument();
    });
  });

  it("should untoggle an already selected tag", async () => {
    vi.mocked(BookCommands.getBookTags).mockResolvedValue([1]);
    vi.mocked(BookCommands.updateBookTags).mockResolvedValue();

    renderWithProviders(
      <SetBookTagsDialog open={true} bookIds={[123]} availableTags={mockTags} onClose={vi.fn()} />,
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
