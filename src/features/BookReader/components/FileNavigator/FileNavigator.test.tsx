import { error } from "@tauri-apps/plugin-log";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DirEntry } from "../../../../domain/entities";
import { mockScrollToRow } from "../../../../test/mocks/components";
import { createReaderActionSpies, TestReader } from "../../../../test/readerInput";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import * as FileNavigatorSlice from "../../fileNavigatorSlice";
import { useFileSelection } from "../../hooks/useFileSelection";
import { ReaderInputProvider } from "../../input/ReaderInputContext";
import * as ReadReducer from "../../slice";
import FileNavigator from "./FileNavigator";

// Mock hooks
vi.mock("../../hooks/useFileSelection", () => ({
  useFileSelection: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../../SidePane/components/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock NavBar, keeping the search field the panel focuses
vi.mock("./NavBar", () => {
  const NavBar = ({ searchInputRef }: { searchInputRef?: React.Ref<HTMLInputElement> }) => (
    <div data-testid="nav-bar">
      <input type="search" ref={searchInputRef} />
    </div>
  );
  NavBar.displayName = "NavBar";
  return { default: NavBar };
});

// Mock actions
vi.mock("../../slice", async () => {
  const actual = await vi.importActual("../../slice");
  return {
    ...actual,
    openBook: vi.fn((payload: unknown) => ({ type: "reader/openBook", payload })),
  };
});
vi.mock("../../fileNavigatorSlice", async () => {
  const actual = await vi.importActual("../../fileNavigatorSlice");
  return {
    ...actual,
    loadDirectory: vi.fn(() => ({ type: "fileNavigator/loadDirectory" })),
    setSearchText: vi.fn((payload: string) => ({ type: "fileNavigator/setSearchText", payload })),
  };
});

describe("FileNavigator", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SidePanelHeader and NavBar", () => {
    renderWithProviders(<FileNavigator />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
    expect(screen.getByTestId("nav-bar")).toBeInTheDocument();
  });

  it("should show CircularProgress when loading", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.isLoading = true;

    renderWithProviders(<FileNavigator />, { preloadedState });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show 'no files' message when entries is empty", () => {
    renderWithProviders(<FileNavigator />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByText(/No supported files/i)).toBeInTheDocument();
  });

  it("should show 'no search results' when search does not match any entry", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.searchText = "Banana";
    preloadedState.fileNavigator.entries = [{ name: "Apple", isDirectory: false, lastModified: 0 }];

    renderWithProviders(<FileNavigator />, { preloadedState });
    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should dispatch openBook when a file is clicked", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", isDirectory: false, lastModified: 0 }];
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("option", { name: /book.zip/i });
    await user.click(rowButton);

    await waitFor(() => {
      expect(ReadReducer.openBook).toHaveBeenCalledWith({
        path: "/book.zip",
        origin: { kind: "fileNavigator" },
      });
    });
  });

  it("returns the keys to the reader after a file is opened by a click", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", isDirectory: false, lastModified: 0 }];
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;
    const actions = createReaderActionSpies();
    renderWithProviders(
      <ReaderInputProvider>
        <TestReader actions={actions} />
        <FileNavigator />
      </ReaderInputProvider>,
      { preloadedState },
    );

    await user.click(await screen.findByRole("option", { name: /book.zip/i }));
    await waitFor(() => expect(ReadReducer.openBook).toHaveBeenCalled());
    await user.keyboard("{ArrowRight}");
    await user.keyboard(" ");
    // Past the 200 ms single-click delay, so a click from Space would have opened the book again.
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(actions.nextPage.mock.calls.length + actions.previousPage.mock.calls.length).toBe(2);
    expect(ReadReducer.openBook).toHaveBeenCalledTimes(1);
  });

  // Moving to a folder already starts its listing; the history effect must not list it again
  it("does not list a folder whose listing is already in flight", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.history = ["/a"];
    preloadedState.fileNavigator.historyIndex = 0;
    preloadedState.fileNavigator.pendingPath = "/a";

    renderWithProviders(<FileNavigator />, { preloadedState });

    expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
  });

  // Switching to another tab unmounts the panel, but the store still holds the folder's listing
  it("does not reload a folder whose listing is already loaded across unmount and remount", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.history = ["/a"];
    preloadedState.fileNavigator.historyIndex = 0;
    preloadedState.fileNavigator.loadedPath = "/a";
    preloadedState.fileNavigator.entries = [
      { name: "book.zip", isDirectory: false, lastModified: 0 },
    ];

    const { store, unmount } = renderWithProviders(<FileNavigator />, { preloadedState });
    expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "book.zip" })).toBeInTheDocument();

    unmount();
    renderWithProviders(<FileNavigator />, { store });

    expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "book.zip" })).toBeInTheDocument();
  });

  // Another folder's load (foreground or background) is still pending: supersede it for /a
  it.each([
    { label: "foreground", isLoading: true },
    { label: "background", isLoading: false },
  ])(
    "reloads the current folder when another folder's $label load is in flight",
    ({ isLoading }) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/a", "/b"];
      preloadedState.fileNavigator.historyIndex = 0;
      preloadedState.fileNavigator.loadedPath = "/a";
      preloadedState.fileNavigator.pendingPath = "/b";
      preloadedState.fileNavigator.isLoading = isLoading;

      renderWithProviders(<FileNavigator />, { preloadedState });

      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
        dirPath: "/a",
        forceUpdate: true,
      });
    },
  );

  // Back and Forward only move the history, so the effect is what lists the folder
  it("lists the current folder when nothing is loading it", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.history = ["/a"];
    preloadedState.fileNavigator.historyIndex = 0;

    renderWithProviders(<FileNavigator />, { preloadedState });

    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
      dirPath: "/a",
      forceUpdate: true,
    });
  });

  it("should dispatch loadDirectory when a directory is double-clicked", async () => {
    const entries: DirEntry[] = [{ name: "folder", isDirectory: true, lastModified: 0 }];
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("option", { name: /folder/i });
    await user.dblClick(rowButton);

    await waitFor(() => {
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalled();
    });
  });

  it("should dispatch loadDirectory when a browsable archive is double-clicked", async () => {
    // Double-clicking a .zip steps into it like a folder rather than opening it as a
    // book; a single click still opens it.
    const entries: DirEntry[] = [{ name: "book.zip", isDirectory: false, lastModified: 0 }];
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("option", { name: /book.zip/i });
    await user.dblClick(rowButton);

    await waitFor(() => {
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalled();
    });
    expect(ReadReducer.openBook).not.toHaveBeenCalled();
  });

  it("should not treat single clicks on different rows as a double-click", async () => {
    // Single-clicking row A then row B within the double-click interval must not be
    // misread as a double-click on B; B is selected and no directory navigation occurs.
    const entries: DirEntry[] = [
      { name: "folderA", isDirectory: true, lastModified: 0 },
      { name: "folderB", isDirectory: true, lastModified: 0 },
    ];
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowA = await screen.findByRole("option", { name: /folderA/i });
    const rowB = await screen.findByRole("option", { name: /folderB/i });

    // Two synchronous clicks land well within the 200ms double-click interval.
    fireEvent.click(rowA);
    fireEvent.click(rowB);

    // A click on a different row must not navigate into the directory.
    expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();

    // The pending single-click resolves to selecting row B.
    await waitFor(() => {
      expect(ReadReducer.openBook).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/folderB" }),
      );
    });
    expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
  });

  it("should open the file when a file is double-clicked", async () => {
    // A PDF is a single document, not a browsable archive, so a double-click opens it.
    const entries: DirEntry[] = [{ name: "book.pdf", isDirectory: false, lastModified: 0 }];
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("option", { name: /book.pdf/i });
    await user.dblClick(rowButton);

    await waitFor(() => {
      expect(ReadReducer.openBook).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/book.pdf" }),
      );
    });
    // A file double-click must not be treated as a directory navigation.
    expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
  });

  it("should scroll to the open book's row", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", isDirectory: false, lastModified: 0 }];
    vi.mocked(useFileSelection).mockImplementationOnce(
      (_fileHistory, _fileHistoryIndex, callback) => {
        callback("book.zip");
      },
    );

    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;
    preloadedState.reader.history = ["/book.zip"];
    preloadedState.reader.historyIndex = 0;

    renderWithProviders(<FileNavigator />, { preloadedState });

    await waitFor(() => {
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 0,
      });
    });
  });

  it("should log error if scrollToRow fails", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", isDirectory: false, lastModified: 0 }];
    vi.mocked(useFileSelection).mockImplementationOnce(
      (_fileHistory, _fileHistoryIndex, callback) => {
        callback("book.zip");
      },
    );

    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.entries = entries;
    preloadedState.reader.history = ["/book.zip"];
    preloadedState.reader.historyIndex = 0;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll failed");
    });

    renderWithProviders(<FileNavigator />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });

  describe("scrolling to the open book", () => {
    const row = (name: string): DirEntry => ({ name, isDirectory: false, lastModified: 0 });

    // Lists /dir with the open book book.zip selected, and waits for the first scroll.
    const renderWithOpenBook = async (entries: DirEntry[]) => {
      vi.mocked(useFileSelection).mockImplementation((_fileHistory, _fileHistoryIndex, select) => {
        useEffect(() => select("book.zip"), [select]);
      });
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/dir"];
      preloadedState.fileNavigator.historyIndex = 0;
      preloadedState.fileNavigator.loadedPath = "/dir";
      preloadedState.fileNavigator.entries = entries;
      preloadedState.reader.history = ["/dir/book.zip"];
      preloadedState.reader.historyIndex = 0;

      const rendered = renderWithProviders(<FileNavigator />, { preloadedState });
      await waitFor(() => expect(mockScrollToRow).toHaveBeenCalledTimes(1));
      mockScrollToRow.mockClear();
      return rendered;
    };

    // What a finished background re-read of /dir puts into the store. `loadDirectory` is
    // mocked in this file, so the action is written out; `requestId` matches the store's.
    const reread = (entries: DirEntry[]) => ({
      type: "fileNavigator/loadDirectory/fulfilled",
      payload: { path: "/dir", entries },
      meta: { requestId: null, arg: { dirPath: "/dir", background: true } },
    });

    // Lets the scroll effect's timer run out.
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    afterEach(() => {
      vi.mocked(useFileSelection).mockReset();
    });

    it("keeps the scroll position when a re-read moves the open book's row", async () => {
      const { store } = await renderWithOpenBook([row("a.zip"), row("book.zip")]);

      act(() => {
        store.dispatch(reread([row("0.zip"), row("a.zip"), row("book.zip")]));
      });
      await settle();

      expect(mockScrollToRow).not.toHaveBeenCalled();
      // The selection follows the open book to its new row.
      expect(screen.getByRole("option", { name: "book.zip" })).toHaveClass("Mui-selected");
      expect(screen.getByRole("option", { name: "a.zip" })).not.toHaveClass("Mui-selected");
    });

    it("scrolls to the open book again when the search changes", async () => {
      const { store } = await renderWithOpenBook([row("a.zip"), row("book.zip")]);

      act(() => {
        store.dispatch({ type: "fileNavigator/setSearchText", payload: "book" });
      });

      await waitFor(() => {
        expect(mockScrollToRow).toHaveBeenCalledWith({
          align: "smart",
          behavior: "instant",
          index: 0,
        });
      });
    });

    it("scrolls to the open book again when a search that hid it is cleared", async () => {
      const { store } = await renderWithOpenBook([row("a.zip"), row("book.zip")]);
      act(() => {
        store.dispatch({ type: "fileNavigator/setSearchText", payload: "a" });
      });
      await settle();

      act(() => {
        store.dispatch({ type: "fileNavigator/setSearchText", payload: "" });
      });

      await waitFor(() => {
        expect(mockScrollToRow).toHaveBeenCalledWith({
          align: "smart",
          behavior: "instant",
          index: 1,
        });
      });
    });

    it("keeps the scroll position when a re-read brings the open book's row back", async () => {
      const { store } = await renderWithOpenBook([row("a.zip"), row("book.zip")]);
      act(() => {
        store.dispatch(reread([row("a.zip")]));
      });
      await settle();

      act(() => {
        store.dispatch(reread([row("a.zip"), row("b.zip"), row("book.zip")]));
      });
      await settle();

      expect(mockScrollToRow).not.toHaveBeenCalled();
    });
  });

  describe("keyboard", () => {
    const file = (name: string): DirEntry => ({ name, isDirectory: false, lastModified: 0 });
    const folder = (name: string): DirEntry => ({ name, isDirectory: true, lastModified: 0 });

    /** Lists `path`, as if its listing had just been read (so mounting does not read it again). */
    const inFolder = (path: string, entries: DirEntry[]) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = [path];
      preloadedState.fileNavigator.historyIndex = 0;
      preloadedState.fileNavigator.loadedPath = path;
      preloadedState.fileNavigator.entries = entries;
      return preloadedState;
    };

    /** Renders the panel inside the side pane, next to a reader that records its page turns. */
    const renderInPane = (preloadedState: ReturnType<typeof createBasePreloadedState>) => {
      const actions = createReaderActionSpies();
      const view = renderWithProviders(
        <ReaderInputProvider>
          <TestReader actions={actions} testId="reader" />
          <div data-side-pane="">
            <FileNavigator />
          </div>
        </ReaderInputProvider>,
        { preloadedState },
      );
      return { ...view, actions };
    };

    type Store = ReturnType<typeof renderInPane>["store"];

    /** The listing arriving; `requestId` matches the store's. */
    const finishLoad = (store: Store, path: string, entries: DirEntry[]) => {
      act(() => {
        store.dispatch({
          type: "fileNavigator/loadDirectory/fulfilled",
          payload: { path, entries },
          meta: { requestId: null, arg: { dirPath: path } },
        });
      });
    };

    const listbox = () => screen.getByRole("listbox", { name: "File Navigator" });
    const activeOption = () => {
      const id = listbox().getAttribute("aria-activedescendant");
      return id === null ? null : document.getElementById(id);
    };

    beforeEach(() => {
      // What the thunk does at once: the folder becomes the current one and loads.
      vi.mocked(FileNavigatorSlice.loadDirectory).mockImplementation(
        ({ dirPath }) =>
          ((dispatch: Store["dispatch"]) => {
            dispatch(FileNavigatorSlice.setIsDirEntriesLoading(true));
            dispatch(FileNavigatorSlice.directoryPathOpened(dirPath));
          }) as unknown as ReturnType<typeof FileNavigatorSlice.loadDirectory>,
      );
    });

    afterEach(() => {
      vi.mocked(FileNavigatorSlice.loadDirectory).mockReset();
      vi.mocked(useFileSelection).mockReset();
    });

    it("opens the active file with Enter at once and returns the keys to the reader", async () => {
      const { actions } = renderInPane(inFolder("/dir", [file("a.zip"), file("b.zip")]));

      await user.keyboard("{F6}{ArrowDown}");
      expect(activeOption()).toBe(screen.getByRole("option", { name: "b.zip" }));
      await user.keyboard("{Enter}");

      // Well within the 200 ms the single-click timer waits.
      expect(ReadReducer.openBook).toHaveBeenCalledWith({
        path: "/dir/b.zip",
        origin: { kind: "fileNavigator" },
      });
      expect(listbox()).not.toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("does not count two quick Enters as a double-click", async () => {
      renderInPane(inFolder("/dir", [folder("sub")]));

      await user.keyboard("{F6}{Enter}{F6}{Enter}");
      // Past the 200 ms single-click delay.
      await act(() => new Promise((resolve) => setTimeout(resolve, 250)));

      expect(ReadReducer.openBook).toHaveBeenCalledTimes(2);
      expect(ReadReducer.openBook).toHaveBeenCalledWith({
        path: "/dir/sub",
        origin: { kind: "fileNavigator" },
      });
      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalledWith(
        expect.objectContaining({ dirPath: "/dir/sub" }),
      );
    });

    it("enters a folder with Right and lands on its first row", async () => {
      const { store, actions } = renderInPane(
        inFolder("/dir", [file("a.zip"), file("b.zip"), folder("sub")]),
      );

      await user.keyboard("{F6}{End}{ArrowRight}");
      expect(FileNavigatorSlice.setSearchText).toHaveBeenCalledWith("");
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({ dirPath: "/dir/sub" });
      finishLoad(store, "/dir/sub", [file("x.zip"), file("y.zip")]);

      expect(listbox()).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "x.zip" }));
      await user.keyboard("{ArrowDown}");
      expect(activeOption()).toBe(screen.getByRole("option", { name: "y.zip" }));
      expect(actions.nextPage).not.toHaveBeenCalled();
    });

    it("does nothing with Right on a file", async () => {
      renderInPane(inFolder("/dir", [file("a.pdf")]));

      await user.keyboard("{F6}{ArrowRight}");

      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
      expect(listbox()).toHaveFocus();
    });

    it("goes to the parent with Left and lands on the folder just left", async () => {
      const { store } = renderInPane(inFolder("/dir/sub", [file("x.zip")]));

      await user.keyboard("{F6}{ArrowLeft}");
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({ dirPath: "/dir" });
      finishLoad(store, "/dir", [file("a.zip"), file("b.zip"), folder("sub"), file("z.zip")]);

      expect(listbox()).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "sub" }));
    });

    it("does nothing with Left at the root and keeps the search", async () => {
      const preloadedState = inFolder("/", [file("x.zip"), file("y.zip")]);
      preloadedState.fileNavigator.searchText = "x";
      const { store } = renderInPane(preloadedState);

      await user.keyboard("{F6}{ArrowLeft}");

      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
      expect(store.getState().fileNavigator.searchText).toBe("x");
      expect(listbox()).toHaveFocus();
    });

    it("does nothing with Left when the parent cannot be resolved", async () => {
      const { dirname } = await import("@tauri-apps/api/path");
      vi.mocked(dirname).mockRejectedValueOnce(new Error("No parent"));
      renderInPane(inFolder("C:\\", [file("x.zip")]));

      await user.keyboard("{F6}{ArrowLeft}");

      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
      expect(listbox()).toHaveFocus();
    });

    it("does nothing with Left when the folder's name cannot be resolved", async () => {
      const { basename } = await import("@tauri-apps/api/path");
      vi.mocked(basename).mockRejectedValueOnce(new Error("No name"));
      renderInPane(inFolder("/dir/..", [file("x.zip")]));

      await user.keyboard("{F6}{ArrowLeft}");
      await waitFor(() => expect(basename).toHaveBeenCalledWith("/dir/.."));

      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
      expect(listbox()).toHaveFocus();
    });

    it("leaves an empty folder with Left", async () => {
      const { store, actions } = renderInPane(inFolder("/dir", [folder("empty")]));

      await user.keyboard("{F6}{ArrowRight}");
      finishLoad(store, "/dir/empty", []);

      const panel = document.activeElement;
      expect(panel).toHaveAttribute("tabindex", "-1");
      expect(panel).toContainElement(screen.getByText("No supported files."));
      await user.keyboard("{ArrowLeft}");
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({ dirPath: "/dir" });
      expect(actions.previousPage).not.toHaveBeenCalled();
      expect(actions.nextPage).not.toHaveBeenCalled();
      finishLoad(store, "/dir", [folder("empty")]);

      expect(listbox()).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "empty" }));
    });

    it("lands on a row, not the search field, after a reload", async () => {
      const preloadedState = inFolder("/dir", []);
      preloadedState.fileNavigator.loadedPath = null;
      preloadedState.fileNavigator.pendingPath = "/dir";
      preloadedState.fileNavigator.isLoading = true;
      preloadedState.fileNavigator.searchText = "b";
      const { store } = renderInPane(preloadedState);

      await user.keyboard("{F6}");
      expect(screen.getByRole("searchbox")).not.toHaveFocus();
      finishLoad(store, "/dir", [file("a.zip"), file("b.zip")]);

      expect(listbox()).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "b.zip" }));
    });

    it("lands on a row after Ctrl+Tab into the panel reads an unloaded folder", async () => {
      // Without `loadedPath` or `pendingPath`, mounting reads the folder.
      const preloadedState = inFolder("/dir", [file("a.zip"), file("b.zip")]);
      preloadedState.fileNavigator.loadedPath = null;
      const actions = createReaderActionSpies();
      const ui = (showPanel: boolean) => (
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">{showPanel && <FileNavigator />}</div>
        </ReaderInputProvider>
      );
      // As with Ctrl+Tab, the request waits for the panel to mount.
      const { store, rerender } = renderWithProviders(ui(false), { preloadedState });
      await user.keyboard("{F6}");
      rerender(ui(true));
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
        dirPath: "/dir",
        forceUpdate: true,
      });
      finishLoad(store, "/dir", [file("a.zip"), file("b.zip")]);

      expect(listbox()).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "a.zip" }));
    });

    it("lands on a row immediately on Ctrl+Tab when already loaded, then follows to the open book", async () => {
      let select: (name: string | null) => void = () => {};
      vi.mocked(useFileSelection).mockImplementation((_fileHistory, _fileHistoryIndex, set) => {
        select = set;
      });
      const preloadedState = inFolder("/dir", [file("a.zip"), file("b.zip")]);
      const actions = createReaderActionSpies();
      const ui = (showPanel: boolean) => (
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">{showPanel && <FileNavigator />}</div>
        </ReaderInputProvider>
      );
      const { rerender } = renderWithProviders(ui(false), { preloadedState });
      await user.keyboard("{F6}");
      rerender(ui(true));

      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
      expect(listbox()).toHaveFocus();
      expect(activeOption()).toBe(screen.getByRole("option", { name: "a.zip" }));

      act(() => select("b.zip"));
      expect(activeOption()).toBe(screen.getByRole("option", { name: "b.zip" }));
    });

    it("lands in the search field when the search hides every entry", async () => {
      const preloadedState = inFolder("/dir", [file("a.zip")]);
      preloadedState.fileNavigator.searchText = "zzz";
      renderInPane(preloadedState);

      await user.keyboard("{F6}");

      expect(screen.getByRole("searchbox")).toHaveFocus();
    });

    it("lands on the open book once its name resolves", async () => {
      let select: (name: string | null) => void = () => {};
      vi.mocked(useFileSelection).mockImplementation((_fileHistory, _fileHistoryIndex, set) => {
        select = set;
      });
      renderInPane(inFolder("/dir", [file("a.zip"), file("b.zip")]));

      await user.keyboard("{F6}");
      expect(activeOption()).toBe(screen.getByRole("option", { name: "a.zip" }));
      act(() => select("b.zip"));

      expect(activeOption()).toBe(screen.getByRole("option", { name: "b.zip" }));
    });

    it("does not scroll away from the folder just left", async () => {
      vi.mocked(useFileSelection).mockImplementation((_fileHistory, _fileHistoryIndex, select) => {
        useEffect(() => select("book.zip"), [select]);
      });
      const { store } = renderInPane(inFolder("/dir/sub", [file("x.zip")]));

      await user.keyboard("{F6}{ArrowLeft}");
      finishLoad(store, "/dir", [file("a.zip"), file("book.zip"), folder("sub")]);
      // Past the open book's 20 ms scroll.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(activeOption()).toBe(screen.getByRole("option", { name: "sub" }));
      expect(mockScrollToRow).toHaveBeenLastCalledWith({
        align: "smart",
        behavior: "instant",
        index: 2,
      });
    });

    it("makes a clicked entry the active row", async () => {
      renderInPane(inFolder("/dir", [file("a.zip"), file("b.zip")]));

      await user.click(screen.getByRole("option", { name: "b.zip" }));

      expect(activeOption()).toBe(screen.getByRole("option", { name: "b.zip" }));
    });

    it("keeps focus in the search field when it is clicked while the list has focus", async () => {
      renderInPane(inFolder("/dir", [file("a.zip")]));

      await user.keyboard("{F6}");
      await user.click(screen.getByRole("searchbox"));

      expect(screen.getByRole("searchbox")).toHaveFocus();
    });

    it("keeps the page turning after a click on the 'no files' message", async () => {
      const { actions } = renderInPane(inFolder("/dir", []));

      await user.click(screen.getByText("No supported files."));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("logs a failed keyboard scroll", async () => {
      renderInPane(inFolder("/dir", [file("a.zip")]));
      mockScrollToRow.mockImplementationOnce(() => {
        throw new Error("Scroll failed");
      });

      await user.keyboard("{F6}");

      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });
  describe("a click on a file with no double-click action", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const renderFiles = async (names: string[]) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.entries = names.map((name) => ({
        name,
        isDirectory: false,
        lastModified: 0,
      }));
      renderWithProviders(<FileNavigator />, { preloadedState });
      const rows = await Promise.all(names.map((name) => screen.findByRole("option", { name })));
      vi.useFakeTimers();
      return rows;
    };

    it("opens a PDF without waiting for a double-click", async () => {
      const [pdf] = await renderFiles(["book.pdf"]);
      fireEvent.click(pdf);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(ReadReducer.openBook).toHaveBeenCalledWith({
        path: "/book.pdf",
        origin: { kind: "fileNavigator" },
      });
    });

    it("still waits on a zip, which a double-click enters", async () => {
      const [zip] = await renderFiles(["book.zip"]);
      fireEvent.click(zip);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(ReadReducer.openBook).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(200));
      expect(ReadReducer.openBook).toHaveBeenCalledTimes(1);
    });

    it("cancels a zip's pending click", async () => {
      const [zip, pdf] = await renderFiles(["book.zip", "book.pdf"]);
      fireEvent.click(zip);
      fireEvent.click(pdf);
      await act(() => vi.advanceTimersByTimeAsync(250));
      expect(ReadReducer.openBook).toHaveBeenCalledTimes(1);
      expect(ReadReducer.openBook).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/book.pdf" }),
      );
    });
  });
});
