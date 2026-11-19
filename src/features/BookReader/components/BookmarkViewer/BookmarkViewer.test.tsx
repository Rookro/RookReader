import { act, createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
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
import { removeBookmark } from "../../bookmarkSlice";
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
    const row = await screen.findByRole("option", { name: /The duel/ });

    const right = createEvent.mouseDown(row, { button: 2, cancelable: true });
    fireEvent(row, right);
    const left = createEvent.mouseDown(row, { button: 0, cancelable: true });
    fireEvent(row, left);

    expect(right.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
  });

  describe("keyboard", () => {
    const threeBookmarks = () => [
      createMockBookmark({ id: 1, name: "Opening", pageIndex: 0 }),
      createMockBookmark({ id: 2, name: "The duel", pageIndex: 11 }),
      createMockBookmark({ id: 3, name: "Ending", pageIndex: 20 }),
    ];

    beforeEach(() => {
      // jsdom has no scrollIntoView.
      Element.prototype.scrollIntoView = vi.fn();
    });

    /** Renders the panel inside the side pane, next to a reader that records its page turns. */
    const renderInPane = () => {
      const actions = createReaderActionSpies();
      const view = renderWithProviders(
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">
            <BookmarkViewer />
          </div>
        </ReaderInputProvider>,
        { preloadedState: stateWithOpenBook() },
      );
      return { ...view, actions };
    };

    const activeOption = () => {
      const id = screen
        .getByRole("listbox", { name: "Bookmarks" })
        .getAttribute("aria-activedescendant");
      return id === null ? null : document.getElementById(id);
    };

    it("lands on the first bookmark and jumps with Enter", async () => {
      givenBookmarks(threeBookmarks());
      const { store } = renderInPane();

      await user.keyboard("{F6}");
      expect(screen.getByRole("listbox")).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: /Opening/ }));

      await user.keyboard("{ArrowDown}{Enter}");
      expect(store.getState().reader.index).toBe(11);
      expect(screen.getByRole("listbox")).not.toHaveFocus();
    });

    it("moves by a page of rows with PageDown", async () => {
      givenBookmarks([
        ...threeBookmarks(),
        createMockBookmark({ id: 4, name: "Epilogue", pageIndex: 30 }),
      ]);
      renderInPane();
      const listbox = screen.getByRole("listbox");
      const rowHeight = 48;
      Object.defineProperty(screen.getByRole("option", { name: /Opening/ }), "offsetHeight", {
        value: rowHeight,
      });
      Object.defineProperty(listbox.parentElement, "clientHeight", { value: 2 * rowHeight });

      await user.keyboard("{F6}{PageDown}");

      expect(activeOption()).toBe(screen.getByRole("option", { name: /Ending/ }));
    });

    it("makes a clicked bookmark the active row", async () => {
      givenBookmarks(threeBookmarks());
      renderInPane();

      await user.click(screen.getByRole("option", { name: /The duel/ }));

      expect(activeOption()).toBe(screen.getByRole("option", { name: /The duel/ }));
    });

    it("keeps the page turning after a click on the panel's title", async () => {
      givenBookmarks(threeBookmarks());
      const { actions } = renderInPane();

      await user.click(screen.getByText("Bookmarks"));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click on the 'no bookmarks' message", async () => {
      const { actions } = renderInPane();

      await user.click(screen.getByText("No bookmarks."));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click below the last bookmark", async () => {
      givenBookmarks(threeBookmarks());
      const { actions } = renderInPane();

      // The scroll box around the list fills the panel below the rows.
      const scrollBox = screen.getByRole("listbox").parentElement;
      if (!scrollBox) throw new Error("no scroll box");
      await user.click(scrollBox);
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("focuses the panel when the last bookmark is removed while the list has focus", async () => {
      givenBookmarks(threeBookmarks());
      const { store, actions } = renderInPane();

      await user.keyboard("{F6}");
      act(() => {
        for (const id of [1, 2, 3]) {
          store.dispatch(removeBookmark.fulfilled(id, "request", id));
        }
      });

      const panel = document.activeElement;
      expect(panel).toHaveAttribute("tabindex", "-1");
      expect(panel).toContainElement(screen.getByText("No bookmarks."));
      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).not.toHaveBeenCalled();
    });
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
