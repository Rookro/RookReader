import { error } from "@tauri-apps/plugin-log";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DirEntry } from "../../../../domain/entities";
import { mockScrollToRow } from "../../../../test/mocks/components";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import * as FileNavigatorSlice from "../../fileNavigatorSlice";
import { useDirectoryWatcher } from "../../hooks/useDirectoryWatcher";
import { useFileSelection } from "../../hooks/useFileSelection";
import * as ReadReducer from "../../slice";
import FileNavigator from "./FileNavigator";

// Mock hooks
vi.mock("../../hooks/useDirectoryWatcher", () => ({ useDirectoryWatcher: vi.fn() }));
vi.mock("../../hooks/useFileSelection", () => ({
  useFileSelection: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../../SidePane/components/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock NavBar
vi.mock("./NavBar", () => {
  const NavBar = () => <div data-testid="nav-bar" />;
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

    const rowButton = await screen.findByRole("button", { name: /book.zip/i });
    await user.click(rowButton);

    await waitFor(() => {
      expect(ReadReducer.openBook).toHaveBeenCalledWith({
        path: "/book.zip",
        origin: { kind: "fileNavigator" },
      });
    });
  });

  it("reads the watched folder again in the background when it changes", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.fileNavigator.history = ["/a"];
    preloadedState.fileNavigator.historyIndex = 0;
    preloadedState.fileNavigator.pendingPath = "/a";

    renderWithProviders(<FileNavigator />, { preloadedState });
    const [watchedPath, onChange] = vi.mocked(useDirectoryWatcher).mock.calls.at(-1) ?? [];
    expect(watchedPath).toBe("/a");

    // The watcher waits for what the callback returns.
    let result: unknown;
    act(() => {
      result = onChange?.();
    });

    expect(result).toEqual({ type: "fileNavigator/loadDirectory" });
    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledTimes(1);
    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
      dirPath: "/a",
      background: true,
    });
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

    const rowButton = await screen.findByRole("button", { name: /folder/i });
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

    const rowButton = await screen.findByRole("button", { name: /book.zip/i });
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

    const rowA = await screen.findByRole("button", { name: /folderA/i });
    const rowB = await screen.findByRole("button", { name: /folderB/i });

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

    const rowButton = await screen.findByRole("button", { name: /book.pdf/i });
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
      preloadedState.fileNavigator.pendingPath = "/dir";
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
      expect(screen.getByRole("button", { name: "book.zip" })).toHaveClass("Mui-selected");
      expect(screen.getByRole("button", { name: "a.zip" })).not.toHaveClass("Mui-selected");
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
});
