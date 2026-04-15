import { error } from "@tauri-apps/plugin-log";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockScrollToRow } from "../../../../test/mocks/components";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import type { DirEntry } from "../../../../types/DirEntry";
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
    preloadedState.read.explorer.isLoading = true;

    renderWithProviders(<FileNavigator />, { preloadedState });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show 'no files' message when entries is empty", () => {
    renderWithProviders(<FileNavigator />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByText(/No supported files/i)).toBeInTheDocument();
  });

  it("should show 'no search results' when search does not match any entry", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.explorer.searchText = "Banana";
    preloadedState.read.explorer.entries = [
      { name: "Apple", is_directory: false, last_modified: "" },
    ];

    renderWithProviders(<FileNavigator />, { preloadedState });
    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should dispatch setContainerFilePath when a file is clicked", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", is_directory: false, last_modified: "" }];
    const preloadedState = createBasePreloadedState();
    preloadedState.read.explorer.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("button", { name: /book.zip/i });
    await user.click(rowButton);

    await waitFor(() => {
      expect(ReadReducer.setContainerFilePath).toHaveBeenCalledWith("/book.zip");
    });
  });

  it("should dispatch updateExploreBasePath when a directory is double-clicked", async () => {
    const entries: DirEntry[] = [{ name: "folder", is_directory: true, last_modified: "" }];
    const preloadedState = createBasePreloadedState();
    preloadedState.read.explorer.entries = entries;

    renderWithProviders(<FileNavigator />, { preloadedState });

    const rowButton = await screen.findByRole("button", { name: /folder/i });
    await user.dblClick(rowButton);

    await waitFor(() => {
      expect(ReadReducer.updateExploreBasePath).toHaveBeenCalled();
    });
  });

  it("should scroll to row when selectedIndex is set", async () => {
    const entries: DirEntry[] = [{ name: "book.zip", is_directory: false, last_modified: "" }];
    vi.mocked(useFileSelection).mockImplementationOnce(
      (_fileHistory, _fileHistoryIndex, _entries, callback) => {
        callback(0);
      },
    );

    const preloadedState = createBasePreloadedState();
    preloadedState.read.explorer.entries = entries;
    preloadedState.read.containerFile.history = ["/book.zip"];
    preloadedState.read.containerFile.historyIndex = 0;

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

    const preloadedState = createBasePreloadedState();
    preloadedState.read.explorer.entries = entries;
    preloadedState.read.containerFile.history = ["/book.zip"];
    preloadedState.read.containerFile.historyIndex = 0;

    mockScrollToRow.mockImplementation(() => {
      throw new Error("Scroll failed");
    });

    renderWithProviders(<FileNavigator />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });
});
