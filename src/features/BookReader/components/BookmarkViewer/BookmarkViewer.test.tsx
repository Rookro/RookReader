import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookmarkCommands from "../../../../bindings/BookmarkCommands";
import type { Bookmark } from "../../../../domain/bookmark/schema";
import { createMockBookmark, createMockBookWithState } from "../../../../test/factories";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../test/utils";
import BookmarkViewer from "./BookmarkViewer";

describe("BookmarkViewer", () => {
  const user = userEvent.setup();

  let loadedBookmarks: Bookmark[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
    loadedBookmarks = [];
  });

  /** Builds a state with a book open, optionally as a novel, and its loaded bookmarks. */
  const stateWithOpenBook = (isNovel = false) => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.book = createMockBookWithState({ id: 42 });
    preloadedState.read.containerFile.isNovel = isNovel;
    preloadedState.bookmark = {
      bookId: 42,
      bookmarks: loadedBookmarks,
      status: "succeeded",
      error: null,
    };
    return preloadedState;
  };

  /** The list `useBookmarkSync` would have loaded for the open book. */
  const givenBookmarks = (bookmarks: Bookmark[]) => {
    loadedBookmarks = bookmarks;
  };

  // Loading the list is useBookmarkSync's job, so the panel shows whatever is loaded
  it("does not fetch bookmarks itself", () => {
    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });

    expect(BookmarkCommands.getBookmarksByBookId).not.toHaveBeenCalled();
  });

  it("should show the empty state when the book has no bookmarks", async () => {
    givenBookmarks([]);
    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });

    expect(await screen.findByText("No bookmarks.")).toBeInTheDocument();
  });

  it("should list the bookmarks with their page numbers", async () => {
    givenBookmarks([
      createMockBookmark({ id: 1, name: "Opening", page_index: 0 }),
      createMockBookmark({ id: 2, name: "The duel", page_index: 11 }),
    ]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });

    expect(await screen.findByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("The duel")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 12")).toBeInTheDocument();
  });

  it("should jump to the page index when a comic bookmark is clicked", async () => {
    givenBookmarks([createMockBookmark({ id: 1, name: "The duel", page_index: 11, cfi: null })]);

    const { store } = renderWithProviders(<BookmarkViewer />, {
      preloadedState: stateWithOpenBook(),
    });
    await user.click(await screen.findByText("The duel"));

    expect(store.getState().read.containerFile.index).toBe(11);
    expect(store.getState().read.containerFile.cfi).toBeNull();
  });

  it("should jump to the CFI when a novel bookmark is clicked", async () => {
    givenBookmarks([
      createMockBookmark({
        id: 1,
        name: "Chapter 2",
        page_index: 3,
        cfi: "epubcfi(/6/8!/4/2/1:0)",
      }),
    ]);

    const { store } = renderWithProviders(<BookmarkViewer />, {
      preloadedState: stateWithOpenBook(true),
    });
    await user.click(await screen.findByText("Chapter 2"));

    const containerFile = store.getState().read.containerFile;
    expect(containerFile.index).toBe(3);
    expect(containerFile.cfi).toBe("epubcfi(/6/8!/4/2/1:0)");
  });

  it("should remove a bookmark from the context menu", async () => {
    givenBookmarks([createMockBookmark({ id: 7, name: "The duel", page_index: 11 })]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("The duel") });
    await user.click(screen.getByRole("menuitem", { name: "Remove bookmark" }));

    await waitFor(() => {
      expect(BookmarkCommands.deleteBookmark).toHaveBeenCalledWith(7);
    });
  });

  it("should rename a bookmark from the context menu", async () => {
    givenBookmarks([createMockBookmark({ id: 7, name: "Opening", page_index: 11 })]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("Opening") });
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "The duel");
    await user.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => {
      expect(BookmarkCommands.renameBookmark).toHaveBeenCalledWith(7, "The duel");
    });
  });

  it("should not rename when the dialog is cancelled", async () => {
    givenBookmarks([createMockBookmark({ id: 7, name: "Opening", page_index: 11 })]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("Opening") });
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(BookmarkCommands.renameBookmark).not.toHaveBeenCalled();
  });
});
