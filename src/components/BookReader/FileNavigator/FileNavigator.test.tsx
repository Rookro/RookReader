import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../../test/utils";
import FileNavigator from "./FileNavigator";
import * as ReadReducer from "../../../reducers/ReadReducer";
import { DirEntry } from "../../../types/DirEntry";
import { error } from "@tauri-apps/plugin-log";
import { useFileSelection } from "../../../hooks/useFileSelection";
import { mockScrollToRow } from "../../../test/mocks/components";

// Mock hooks
vi.mock("../../../hooks/useDirectoryWatcher", () => ({ useDirectoryWatcher: vi.fn() }));
vi.mock("../../../hooks/useFileSelection", () => ({
  useFileSelection: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../SidePane/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock NavBar
vi.mock("./NavBar", () => {
  const NavBar = () => <div data-testid="nav-bar" />;
  NavBar.displayName = "NavBar";
  return { default: NavBar };
});

// Mock actions
vi.mock("../../../reducers/ReadReducer", async () => {
  const actual = (await vi.importActual("../../../reducers/ReadReducer")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    updateExploreBasePath: vi.fn(() => ({ type: "explorer/updateExploreBasePath" })),
    setContainerFilePath: vi.fn((payload: string) => ({
      type: "read/setContainerFilePath",
      payload,
    })),
    setSearchText: vi.fn((payload: string) => ({ type: "explorer/setSearchText", payload })),
  };
});

describe("FileNavigator", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = {
    read: {
      explorer: {
        isLoading: false,
        entries: [],
        history: ["/"],
        historyIndex: 0,
        searchText: "",
        sortOrder: "name-asc" as const,
        isWatchEnabled: false,
      },
      containerFile: {
        history: [],
        historyIndex: -1,
        entries: [],
        index: 0,
        isNovel: false,
        isLoading: false,
        isDirectory: false,
        book: null,
        cfi: null,
        error: null,
      },
    },
  } as unknown as RootState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SidePanelHeader and NavBar", () => {
    renderWithProviders(<FileNavigator />, { preloadedState: defaultPreloadedState });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
    expect(screen.getByTestId("nav-bar")).toBeInTheDocument();
  });

  it("should show CircularProgress when loading", () => {
    const loadingState = {
      read: {
        ...defaultPreloadedState.read,
        explorer: { ...defaultPreloadedState.read.explorer, isLoading: true },
      },
    } as unknown as RootState;

    renderWithProviders(<FileNavigator />, { preloadedState: loadingState });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show 'no files' message when entries is empty", () => {
    renderWithProviders(<FileNavigator />, { preloadedState: defaultPreloadedState });
    expect(screen.getByText(/No supported files/i)).toBeInTheDocument();
  });

  it("should show 'no search results' when search does not match any entry", async () => {
    const preloadedState = {
      read: {
        ...defaultPreloadedState.read,
        explorer: {
          ...defaultPreloadedState.read.explorer,
          searchText: "Banana",
          entries: [{ name: "Apple", is_directory: false, last_modified: "" }],
        },
      },
    } as unknown as RootState;

    renderWithProviders(<FileNavigator />, { preloadedState });
    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should dispatch setContainerFilePath when a file is clicked", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", is_directory: false, last_modified: "" }];
    const preloadedState = {
      read: {
        ...defaultPreloadedState.read,
        explorer: {
          ...defaultPreloadedState.read.explorer,
          entries,
        },
      },
    } as unknown as RootState;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("button", { name: /book.zip/i });
    await user.click(rowButton);

    await waitFor(
      () => {
        expect(ReadReducer.setContainerFilePath).toHaveBeenCalledWith("/book.zip");
      },
      { timeout: 2000 },
    );
  });

  it("should dispatch updateExploreBasePath when a directory is double-clicked", async () => {
    const entries: DirEntry[] = [{ name: "folder", is_directory: true, last_modified: "" }];
    const preloadedState = {
      read: {
        ...defaultPreloadedState.read,
        explorer: {
          ...defaultPreloadedState.read.explorer,
          entries,
        },
      },
    } as unknown as RootState;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("button", { name: /folder/i });
    await user.dblClick(rowButton);

    await waitFor(
      () => {
        expect(ReadReducer.updateExploreBasePath).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });

  it("should scroll to row when selectedIndex is set", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", is_directory: false, last_modified: "" }];
    vi.mocked(useFileSelection).mockImplementationOnce(
      (_fileHistory, _fileHistoryIndex, _entries, callback) => {
        callback(0);
      },
    );

    const preloadedState = {
      read: {
        ...defaultPreloadedState.read,
        explorer: {
          ...defaultPreloadedState.read.explorer,
          entries,
        },
        containerFile: {
          history: ["/book.zip"],
          historyIndex: 0,
        },
      },
    } as unknown as RootState;

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
    const entries: DirEntry[] = [{ name: "book.zip", is_directory: false, last_modified: "" }];
    vi.mocked(useFileSelection).mockImplementationOnce(
      (_fileHistory, _fileHistoryIndex, _entries, callback) => {
        callback(0);
      },
    );

    const preloadedState = {
      read: {
        ...defaultPreloadedState.read,
        explorer: {
          ...defaultPreloadedState.read.explorer,
          entries,
        },
        containerFile: {
          history: ["/book.zip"],
          historyIndex: 0,
        },
      },
    } as unknown as RootState;

    mockScrollToRow.mockImplementation(() => {
      throw new Error("Scroll failed");
    });

    renderWithProviders(<FileNavigator />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });
});
