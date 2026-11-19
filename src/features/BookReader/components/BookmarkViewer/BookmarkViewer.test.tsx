import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../bindings/api";
import type { Bookmark } from "../../../../domain/entities";
import { createMockBookmark, createMockBookWithState } from "../../../../test/factories";
import { createReaderActionSpies, TestReader } from "../../../../test/readerInput";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../test/utils";
import { ReaderInputProvider } from "../../input/ReaderInputContext";
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
    preloadedState.reader.book = createMockBookWithState({ id: 42 });
    preloadedState.reader.isNovel = isNovel;
    preloadedState.bookmark = {
      bookId: 42,
      bookmarks: loadedBookmarks,
      status: "succeeded",
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

    expect(api.getBookmarksByBookId).not.toHaveBeenCalled();
  });

  it("should show the empty state when the book has no bookmarks", async () => {
    givenBookmarks([]);
    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });

    expect(await screen.findByText("No bookmarks.")).toBeInTheDocument();
  });

  it("should list the bookmarks with their page numbers", async () => {
    givenBookmarks([
      createMockBookmark({ id: 1, name: "Opening", pageIndex: 0 }),
      createMockBookmark({ id: 2, name: "The duel", pageIndex: 11 }),
    ]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });

    expect(await screen.findByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("The duel")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 12")).toBeInTheDocument();
  });

  it("should jump to the page index when a comic bookmark is clicked", async () => {
    givenBookmarks([createMockBookmark({ id: 1, name: "The duel", pageIndex: 11, cfi: null })]);

    const { store } = renderWithProviders(<BookmarkViewer />, {
      preloadedState: stateWithOpenBook(),
    });
    await user.click(await screen.findByText("The duel"));

    expect(store.getState().reader.index).toBe(11);
    expect(store.getState().reader.cfi).toBeNull();
  });

  it("should jump to the CFI when a novel bookmark is clicked", async () => {
    givenBookmarks([
      createMockBookmark({
        id: 1,
        name: "Chapter 2",
        pageIndex: 3,
        cfi: "epubcfi(/6/8!/4/2/1:0)",
      }),
    ]);

    const { store } = renderWithProviders(<BookmarkViewer />, {
      preloadedState: stateWithOpenBook(true),
    });
    await user.click(await screen.findByText("Chapter 2"));

    const reader = store.getState().reader;
    expect(reader.index).toBe(3);
    expect(reader.cfi).toBe("epubcfi(/6/8!/4/2/1:0)");
  });

  it("should remove a bookmark from the context menu", async () => {
    givenBookmarks([createMockBookmark({ id: 7, name: "The duel", pageIndex: 11 })]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("The duel") });
    await user.click(screen.getByRole("menuitem", { name: "Remove bookmark" }));

    await waitFor(() => {
      expect(api.deleteBookmark).toHaveBeenCalledWith(7);
    });
  });

  it("returns Space to the reader after a bookmark's right-click menu is closed", async () => {
    givenBookmarks([createMockBookmark({ id: 1, name: "The duel", pageIndex: 11, cfi: null })]);
    const actions = createReaderActionSpies();
    const { store } = renderWithProviders(
      <ReaderInputProvider>
        <TestReader actions={actions} />
        <BookmarkViewer />
      </ReaderInputProvider>,
      { preloadedState: stateWithOpenBook() },
    );

    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("The duel") });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await user.keyboard(" ");

    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(store.getState().reader.index).toBe(0);
  });

  it("does not focus a bookmark row on a right-button mousedown", async () => {
    givenBookmarks([createMockBookmark({ id: 1, name: "The duel" })]);
    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    const row = await screen.findByRole("button", { name: /The duel/ });

    const right = createEvent.mouseDown(row, { button: 2, cancelable: true });
    fireEvent(row, right);
    const left = createEvent.mouseDown(row, { button: 0, cancelable: true });
    fireEvent(row, left);

    expect(right.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
  });

  it("should rename a bookmark from the context menu", async () => {
    givenBookmarks([createMockBookmark({ id: 7, name: "Opening", pageIndex: 11 })]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("Opening") });
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "The duel");
    await user.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => {
      expect(api.renameBookmark).toHaveBeenCalledWith(7, "The duel");
    });
  });

  it("should not rename when the dialog is cancelled", async () => {
    givenBookmarks([createMockBookmark({ id: 7, name: "Opening", pageIndex: 11 })]);

    renderWithProviders(<BookmarkViewer />, { preloadedState: stateWithOpenBook() });
    await user.pointer({ keys: "[MouseRight]", target: await screen.findByText("Opening") });
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.renameBookmark).not.toHaveBeenCalled();
  });
});
