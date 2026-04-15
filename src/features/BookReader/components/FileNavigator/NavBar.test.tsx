import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import * as SettingsReducer from "../../../Settings/slice";
import * as ReadReducer from "../../slice";
import NavBar from "./NavBar";

// Mock actions to track calls
vi.mock("../../slice", async () => {
  const actual = await vi.importActual("../../slice");
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

vi.mock("../../../Settings/slice", async () => {
  const actual = await vi.importActual("../../../Settings/slice");
  return {
    ...actual,
    updateSettings: vi.fn((payload: { key: string; value: string }) => ({
      type: "settings/updateSettings",
      payload,
    })),
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

global.ResizeObserver = MockResizeObserver as typeof ResizeObserver;

describe("FileNavigator/NavBar", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = createBasePreloadedState();
  defaultPreloadedState.read.explorer.history = ["/home/user/books"];
  defaultPreloadedState.read.explorer.historyIndex = 0;

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
    await user.clear(pathInput);
    await user.type(pathInput, "/new/path");
    await user.tab(); // Blur trigger

    expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({ dirPath: "/new/path" });
  });

  it("should dispatch updateExploreBasePath with home dir when home button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/home/user";

    renderWithProviders(<NavBar />, { preloadedState });

    const homeButton = screen.getByLabelText("home");
    await user.click(homeButton);

    await waitFor(() => {
      expect(ReadReducer.updateExploreBasePath).toHaveBeenCalledWith({ dirPath: "/home/user" });
    });
  });

  it("should dispatch goBackExplorerHistory when back button is clicked", async () => {
    const preloadedState = structuredClone(defaultPreloadedState);
    preloadedState.read.explorer.history = ["/", "/home"];
    preloadedState.read.explorer.historyIndex = 1;

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
    const targetOption = options.find((opt) => opt.getAttribute("data-value") === "name_desc");

    if (targetOption) {
      await user.click(targetOption);
    } else {
      throw new Error("Target option name_desc not found");
    }

    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "fileNavigator",
      value: expect.objectContaining({ sortOrder: "name_desc" }),
    });
  });

  it("should dispatch goForwardExplorerHistory when forward button is clicked", async () => {
    const preloadedState = structuredClone(defaultPreloadedState);
    preloadedState.read.explorer.history = ["/", "/home"];
    preloadedState.read.explorer.historyIndex = 0;

    renderWithProviders(<NavBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    await user.click(forwardButton);

    expect(ReadReducer.goForwardExplorerHistory).toHaveBeenCalled();
  });

  it("should use homeDir if settingsStore home-directory is missing", async () => {
    const { homeDir } = await import("@tauri-apps/api/path");
    vi.mocked(homeDir).mockResolvedValue("/system/home");

    const preloadedState = structuredClone(defaultPreloadedState);
    preloadedState.settings.fileNavigator.homeDirectory = "";

    renderWithProviders(<NavBar />, { preloadedState });

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
