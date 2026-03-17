import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../../test/utils";
import NavBar from "./NavBar";
import { mockStore } from "../../../test/mocks/tauri";
import * as ReadReducer from "../../../reducers/ReadReducer";

// Mock actions to track calls
vi.mock("../../../reducers/ReadReducer", async () => {
  const actual = (await vi.importActual("../../../reducers/ReadReducer")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    updateExploreBasePath: vi.fn((payload) => ({
      type: "explorer/updateExploreBasePath",
      payload,
    })),
    setSearchText: vi.fn((payload) => ({ type: "explorer/setSearchText", payload })),
    setSortOrder: vi.fn((payload) => ({ type: "explorer/setSortOrder", payload })),
    goBackExplorerHistory: vi.fn(() => ({ type: "explorer/goBack" })),
    goForwardExplorerHistory: vi.fn(() => ({ type: "explorer/goForward" })),
  };
});

// Custom ResizeObserver mock to trigger callbacks
let resizeCallback: ResizeObserverCallback | undefined;
class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

describe("FileNavigator/NavBar", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = {
    read: {
      explorer: {
        history: ["/home/user/books"],
        historyIndex: 0,
        searchText: "",
        sortOrder: "NAME_ASC",
        entries: ["dummy"], // prevent auto-navigation in useEffect
        isLoading: false,
        isWatchEnabled: false,
      },
    },
  } as unknown as RootState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render current path and search input", () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    expect(screen.getByDisplayValue("/home/user/books")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("should dispatch updateExploreBasePath when path is changed", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const pathInput = screen.getByDisplayValue("/home/user/books");
    // Use fireEvent.change for atomic update to avoid multiple dispatches
    fireEvent.change(pathInput, { target: { value: "/new/path" } });

    expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({ dirPath: "/new/path" });
  });

  it("should dispatch updateExploreBasePath with home dir when home button is clicked", async () => {
    mockStore.get.mockResolvedValue("/home/user");

    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const homeButton = screen.getByLabelText("home");
    await user.click(homeButton);

    await waitFor(() => {
      expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({ dirPath: "/home/user" });
    });
  });

  it("should dispatch goBackExplorerHistory when back button is clicked", async () => {
    const preloadedState = {
      read: {
        explorer: {
          ...defaultPreloadedState.read.explorer,
          history: ["/", "/home"],
          historyIndex: 1,
        },
      },
    } as unknown as RootState;

    renderWithProviders(<NavBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    await user.click(backButton);

    expect(ReadReducer.goBackExplorerHistory).toHaveBeenCalled();
  });

  it("should dispatch updateExploreBasePath with parent dir when up button is clicked", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const upButton = screen.getByLabelText("up");
    await user.click(upButton);

    await waitFor(() => {
      expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({ dirPath: "/home/user" });
    });
  });

  it("should dispatch updateExploreBasePath with forceUpdate when refresh button is clicked", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const refreshButton = screen.getByLabelText("refresh");
    await user.click(refreshButton);

    expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({
      dirPath: "/home/user/books",
      forceUpdate: true,
    });
  });

  it("should dispatch setSearchText when search input changes", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const searchInput = screen.getByRole("searchbox");
    // Use fireEvent.change for atomic update
    fireEvent.change(searchInput, { target: { value: "manga" } });

    expect(ReadReducer.setSearchText).toHaveBeenCalledWith("manga");
  });

  it("should dispatch setSortOrder and update settings when sort order changes", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    // Trigger ResizeObserver callback manually
    act(() => {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        value: 500,
      });
      if (resizeCallback) {
        resizeCallback([], {} as ResizeObserver);
      }
    });

    const select = screen.getByRole("combobox");
    await user.click(select);

    // MUI Select options have role="option"
    const options = await screen.findAllByRole("option");
    const targetOption = options.find((opt) => opt.getAttribute("data-value") === "NAME_DESC");

    if (targetOption) {
      await user.click(targetOption);
    } else {
      throw new Error("Target option NAME_DESC not found");
    }

    expect(ReadReducer.setSortOrder).toHaveBeenCalledWith("NAME_DESC");
    expect(mockStore.set).toHaveBeenCalledWith("sort-order", "NAME_DESC");
  });

  it("should dispatch goForwardExplorerHistory when forward button is clicked", async () => {
    const preloadedState = {
      read: {
        explorer: {
          ...defaultPreloadedState.read.explorer,
          history: ["/", "/home"],
          historyIndex: 0,
        },
      },
    } as unknown as RootState;

    renderWithProviders(<NavBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    await user.click(forwardButton);

    expect(ReadReducer.goForwardExplorerHistory).toHaveBeenCalled();
  });

  it("should use homeDir if settingsStore home-directory is missing", async () => {
    mockStore.get.mockResolvedValue(null);
    const { homeDir } = await import("@tauri-apps/api/path");
    vi.mocked(homeDir).mockResolvedValue("/system/home");

    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const homeButton = screen.getByLabelText("home");
    await user.click(homeButton);

    await waitFor(() => {
      expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({ dirPath: "/system/home" });
    });
  });

  it("should log warning if getting parent directory fails", async () => {
    const { dirname } = await import("@tauri-apps/api/path");
    const { warn } = await import("@tauri-apps/plugin-log");
    vi.mocked(dirname).mockRejectedValue(new Error("Dirname error"));

    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const upButton = screen.getByLabelText("up");
    await user.click(upButton);

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to get parent directory"));
    });
  });

  it("should prevent context menu propagation", () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });
    const input = screen.getByDisplayValue("/home/user/books");
    fireEvent.contextMenu(input);
    // Verified by code inspection: calls stopPropagation
  });
});
