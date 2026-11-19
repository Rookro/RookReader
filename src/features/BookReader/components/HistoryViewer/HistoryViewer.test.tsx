import { error } from "@tauri-apps/plugin-log";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../bindings/api";
import { createMockBookWithState } from "../../../../test/factories";
import { mockScrollToRow } from "../../../../test/mocks/components";
import { createReaderActionSpies, TestReader } from "../../../../test/readerInput";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import { fetchRecentlyReadBooks } from "../../../History/slice";
import { useHistoryIndex } from "../../hooks/useHistoryIndex";
import { ReaderInputProvider } from "../../input/ReaderInputContext";
import * as ReadReducer from "../../slice";
import HistoryViewer from "./HistoryViewer";

// Mock hooks
vi.mock("../../../History/hooks/useHistoryEntriesUpdater", () => ({
  useHistoryEntriesUpdater: vi.fn(),
}));
vi.mock("../../hooks/useHistoryIndex", () => ({
  useHistoryIndex: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../../SidePane/components/SidePanelHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="side-panel-header">
      {title}
      {actions}
    </div>
  ),
}));

// Mock actions
vi.mock("../../slice", async () => {
  const actual = await vi.importActual("../../slice");
  return {
    ...actual,
    openBook: vi.fn((payload: unknown) => ({ type: "reader/openBook", payload })),
  };
});

describe("HistoryViewer", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useHistoryIndex).mockReturnValue(-1);
  });

  it("should render SidePanelHeader and Search input", () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("should show 'no history' message when recentlyReadBooks is empty", () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByText("No history.")).toBeInTheDocument();
  });

  it("should render list items when history entries are present", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
      createMockBookWithState({ id: 2, filePath: "/path/2", displayName: "Book 2" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });
    expect(screen.getByText("Book 1")).toBeInTheDocument();
    expect(screen.getByText("Book 2")).toBeInTheDocument();
  });

  it("should dispatch openBook when an item is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const rowButton = screen.getByRole("option", { name: /Book 1/i });
    await user.click(rowButton);

    expect(ReadReducer.openBook).toHaveBeenCalledWith({
      path: "/path/1",
      origin: { kind: "history" },
    });
  });

  it("returns Space to the reader after a row's right-click menu is closed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
    ];
    const actions = createReaderActionSpies();
    renderWithProviders(
      <ReaderInputProvider>
        <TestReader actions={actions} />
        <HistoryViewer />
      </ReaderInputProvider>,
      { preloadedState },
    );

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Book 1") });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await user.keyboard(" ");

    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(ReadReducer.openBook).not.toHaveBeenCalled();
  });

  it("should filter results based on search input", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Apple" }),
      createMockBookWithState({ id: 2, filePath: "/path/2", displayName: "Banana" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Apple");

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("should show 'no search results' when search does not match any entry", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Apple" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Banana");

    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should scroll to row when selectedIndex is set", async () => {
    vi.mocked(useHistoryIndex).mockReturnValue(1);

    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ filePath: "/path/1", displayName: "B1" }),
      createMockBookWithState({ filePath: "/path/2", displayName: "B2" }),
    ];
    preloadedState.reader.history = ["/path/2"];
    preloadedState.reader.historyIndex = 0;

    renderWithProviders(<HistoryViewer />, { preloadedState });

    await waitFor(() => {
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 1,
      });
    });
  });

  it("should log error if scrollToRow fails", async () => {
    vi.mocked(useHistoryIndex).mockReturnValue(0);

    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [createMockBookWithState({ filePath: "/path/2" })];
    preloadedState.reader.history = ["/path/2"];
    preloadedState.reader.historyIndex = 0;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll error");
    });

    renderWithProviders(<HistoryViewer />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });

  it("closes a row's context menu when a different book with the same name takes its place", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/a/Vol 1.cbz", displayName: "Vol 1.cbz" }),
    ];

    const { store } = renderWithProviders(<HistoryViewer />, { preloadedState });
    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Vol 1.cbz") });
    expect(screen.getByText("Remove history")).toBeInTheDocument();

    act(() => {
      store.dispatch(
        fetchRecentlyReadBooks.fulfilled(
          [createMockBookWithState({ id: 2, filePath: "/b/Vol 1.cbz", displayName: "Vol 1.cbz" })],
          "r1",
        ),
      );
    });

    expect(screen.queryByText("Remove history")).not.toBeInTheDocument();
  });

  it("should prevent context menu propagation", async () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    const searchInput = screen.getByRole("searchbox");

    const event = fireEvent.contextMenu(searchInput);
    expect(event).toBe(true);
  });

  describe("keyboard", () => {
    const threeBooks = () => [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
      createMockBookWithState({ id: 2, filePath: "/path/2", displayName: "Book 2" }),
      createMockBookWithState({ id: 3, filePath: "/path/3", displayName: "Book 3" }),
    ];

    const withBooks = (books = threeBooks()) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.history.recentlyReadBooks = books;
      return preloadedState;
    };

    /** Renders the panel inside the side pane, next to a reader that records its page turns. */
    const renderInPane = (preloadedState = withBooks()) => {
      const actions = createReaderActionSpies();
      const view = renderWithProviders(
        <ReaderInputProvider>
          <TestReader actions={actions} testId="reader" />
          <div data-side-pane="">
            <HistoryViewer />
          </div>
        </ReaderInputProvider>,
        { preloadedState },
      );
      return { ...view, actions };
    };

    const activeOption = () => {
      const id = screen
        .getByRole("listbox", { name: "History" })
        .getAttribute("aria-activedescendant");
      return id === null ? null : document.getElementById(id);
    };

    /** Replaces the history, as the readingHistoryChanged refetch does. */
    const refetch = (
      store: ReturnType<typeof renderInPane>["store"],
      books: ReturnType<typeof threeBooks>,
    ) => {
      act(() => {
        store.dispatch(fetchRecentlyReadBooks.fulfilled(books, "refetch"));
      });
    };

    it("lands on the open book and opens the active entry with Enter", async () => {
      vi.mocked(useHistoryIndex).mockReturnValue(1);
      const { actions } = renderInPane();

      await user.keyboard("{F6}");
      expect(screen.getByRole("listbox")).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "Book 2" }));

      await user.keyboard("{ArrowDown}");
      expect(activeOption()).toBe(screen.getByRole("option", { name: "Book 3" }));
      expect(actions.nextPage).not.toHaveBeenCalled();

      await user.keyboard("{Enter}");
      expect(ReadReducer.openBook).toHaveBeenCalledWith({
        path: "/path/3",
        origin: { kind: "history" },
      });
      expect(screen.getByRole("listbox")).not.toHaveFocus();

      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("clears the search on the first Escape and returns to the reader on the second", async () => {
      const { actions } = renderInPane();
      const searchbox = screen.getByRole("searchbox");

      await user.type(searchbox, "abc");
      await user.keyboard("{Escape}");
      expect(searchbox).toHaveValue("");
      expect(searchbox).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(document.body);

      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the search when Escape ends an IME composition", async () => {
      renderInPane();
      const searchbox = screen.getByRole("searchbox");

      await user.type(searchbox, "abc");
      // WebKitGTK fires it after compositionend, with isComposing false.
      fireEvent.keyDown(searchbox, { key: "Escape", keyCode: 229 });

      expect(searchbox).toHaveValue("abc");
      expect(searchbox).toHaveFocus();
    });

    it("lands in the search field when the search hides every entry", async () => {
      renderInPane();

      await user.type(screen.getByRole("searchbox"), "zzz");
      await user.click(screen.getByTestId("reader"));
      await user.keyboard("{F6}");

      expect(screen.getByRole("searchbox")).toHaveFocus();
    });

    it("keeps focus in the search field when it is clicked while the list has focus", async () => {
      renderInPane();

      await user.keyboard("{F6}");
      await user.click(screen.getByRole("searchbox"));

      expect(screen.getByRole("searchbox")).toHaveFocus();
    });

    it("moves to the next entry when the active one is removed", async () => {
      const [first, , third] = threeBooks();
      const { store } = renderInPane();

      await user.keyboard("{F6}{ArrowDown}");
      expect(activeOption()).toBe(screen.getByRole("option", { name: "Book 2" }));
      refetch(store, [first, third]);

      expect(screen.getByRole("listbox")).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "Book 3" }));
    });

    it("focuses the panel when the last entry is removed", async () => {
      const { store, actions } = renderInPane(withBooks(threeBooks().slice(0, 1)));

      await user.keyboard("{F6}");
      refetch(store, []);

      const panel = document.activeElement;
      expect(panel).toHaveAttribute("tabindex", "-1");
      expect(panel).toContainElement(screen.getByText("No history."));
      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).not.toHaveBeenCalled();
    });

    it("focuses the search field when the last matching entry is removed", async () => {
      const [first, , third] = threeBooks();
      const { store } = renderInPane();

      await user.type(screen.getByRole("searchbox"), "Book 2");
      await user.click(screen.getByTestId("reader"));
      await user.keyboard("{F6}");
      expect(screen.getByRole("listbox")).toHaveFocus();
      refetch(store, [first, third]);

      expect(screen.getByRole("searchbox")).toHaveFocus();
    });

    it("does not turn the page after Clear all confirmed with the keyboard", async () => {
      const { store, actions } = renderInPane();
      const clearAll = screen.getByRole("button", { name: "Clear all history" });

      for (let i = 0; i < 10 && document.activeElement !== clearAll; i++) {
        await user.tab();
      }
      expect(clearAll).toHaveFocus();
      await user.keyboard("{Enter}");
      const dialog = screen.getByRole("dialog", { name: "Clear all reading history?" });
      await user.tab();
      expect(within(dialog).getByRole("button", { name: "Clear all" })).toHaveFocus();
      await user.keyboard("{Enter}");
      await waitFor(() => expect(api.clearAllReadingHistory).toHaveBeenCalledTimes(1));
      refetch(store, []);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      // A browser drops focus from a button that becomes disabled; jsdom keeps it there.
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement && focused.disabled) {
        act(() => focused.blur());
      }

      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).not.toHaveBeenCalled();
    });

    it("makes a clicked entry the active row", async () => {
      renderInPane();

      await user.click(screen.getByRole("option", { name: "Book 3" }));

      expect(activeOption()).toBe(screen.getByRole("option", { name: "Book 3" }));
    });

    it("keeps the active entry, not the open book, in view while the list has focus", async () => {
      vi.mocked(useHistoryIndex).mockReturnValue(0);
      renderInPane();

      await user.keyboard("{F6}{ArrowDown}");
      // Past the open book's 20 ms scroll.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(mockScrollToRow).toHaveBeenLastCalledWith({
        align: "smart",
        behavior: "instant",
        index: 1,
      });
    });

    it("scrolls to the open book when the pane is entered before the panel mounts", async () => {
      vi.mocked(useHistoryIndex).mockReturnValue(40);
      const preloadedState = withBooks(
        Array.from({ length: 50 }, (_, i) =>
          createMockBookWithState({ id: i + 1, filePath: `/path/${i + 1}` }),
        ),
      );
      const actions = createReaderActionSpies();
      const ui = (showPanel: boolean) => (
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">{showPanel && <HistoryViewer />}</div>
        </ReaderInputProvider>
      );
      // As with Ctrl+Tab, the request waits for the panel to mount.
      const { rerender } = renderWithProviders(ui(false), { preloadedState });
      await user.keyboard("{F6}");
      rerender(ui(true));
      // Past the open book's 20 ms scroll, which the focused list skips.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(screen.getByRole("listbox")).toHaveFocus();
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 40,
      });
    });

    it("logs a failed keyboard scroll", async () => {
      renderInPane();
      mockScrollToRow.mockImplementationOnce(() => {
        throw new Error("Scroll failed");
      });

      await user.keyboard("{F6}");

      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });

    it("keeps the page turning after a click on the panel's title", async () => {
      const { actions } = renderInPane();

      await user.click(screen.getByText("History"));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click on the 'no history' message", async () => {
      const { actions } = renderInPane(createBasePreloadedState());

      await user.click(screen.getByText("No history."));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearing all history", () => {
    const withHistory = () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.history.recentlyReadBooks = [
        createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
      ];
      return preloadedState;
    };

    it("is disabled while the history is empty", () => {
      renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });

      expect(screen.getByRole("button", { name: "Clear all history" })).toBeDisabled();
    });

    it("clears every entry after the confirmation", async () => {
      const { store } = renderWithProviders(<HistoryViewer />, { preloadedState: withHistory() });

      await user.click(screen.getByRole("button", { name: "Clear all history" }));
      expect(
        screen.getByRole("dialog", { name: "Clear all reading history?" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Clear all" }));

      await waitFor(() => expect(api.clearAllReadingHistory).toHaveBeenCalledTimes(1));
      expect(store.getState().history.recentlyReadBooks).toEqual([]);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("keeps the history when the confirmation is cancelled", async () => {
      const { store } = renderWithProviders(<HistoryViewer />, { preloadedState: withHistory() });

      await user.click(screen.getByRole("button", { name: "Clear all history" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(api.clearAllReadingHistory).not.toHaveBeenCalled();
      expect(store.getState().history.recentlyReadBooks).toHaveLength(1);
    });
  });
});
