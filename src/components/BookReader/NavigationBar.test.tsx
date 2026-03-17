import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../test/utils";
import NavigationBar from "./NavigationBar";
import { mockStore } from "../../test/mocks/tauri";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

describe("NavigationBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize view settings from settingsStore on mount", async () => {
    mockStore.get.mockImplementation((key) => {
      if (key === "direction") return Promise.resolve("rtl");
      if (key === "two-paged") return Promise.resolve(false);
      return Promise.resolve(null);
    });

    const { store } = renderWithProviders(<NavigationBar />);

    await waitFor(() => {
      expect(store.getState().view.direction).toBe("rtl");
      expect(store.getState().view.isTwoPagedView).toBe(false);
    });
  });

  it("should dispatch setActiveView('bookshelf') when library button is clicked", async () => {
    const { store } = renderWithProviders(<NavigationBar />);

    // MUI Tooltip with translation "Move to Bookshelf"
    const libraryButton = screen.getByLabelText("Move to Bookshelf");
    await user.click(libraryButton);

    expect(store.getState().view.activeView).toBe("bookshelf");
  });

  it("should dispatch goBackContainerHistory when back button is clicked", async () => {
    const preloadedState = {
      read: {
        containerFile: {
          history: ["/path/1", "/path/2"],
          historyIndex: 1,
          entries: [],
          index: 0,
        },
      },
    } as unknown as RootState;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    await user.click(backButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(0);
  });

  it("should disable back button if historyIndex <= 0", () => {
    const preloadedState = {
      read: {
        containerFile: {
          history: ["/path/1"],
          historyIndex: 0,
          entries: [],
          index: 0,
        },
      },
    } as unknown as RootState;

    renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    expect(backButton).toBeDisabled();
  });

  it("should toggle isTwoPagedView when button is clicked", async () => {
    mockStore.get.mockResolvedValue(true);
    const preloadedState = {
      view: { isTwoPagedView: true, direction: "ltr" as const, activeView: "reader" as const },
    } as unknown as RootState;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    await waitFor(() => expect(mockStore.get).toHaveBeenCalledWith("two-paged"));

    const toggleButton = screen.getByLabelText("toggle-two-paged");
    await user.click(toggleButton);

    expect(store.getState().view.isTwoPagedView).toBe(false);
    expect(mockStore.set).toHaveBeenCalledWith("two-paged", false);
  });

  it("should toggle direction when button is clicked", async () => {
    mockStore.get.mockResolvedValue("ltr");
    const preloadedState = {
      view: { isTwoPagedView: true, direction: "ltr" as const, activeView: "reader" as const },
    } as unknown as RootState;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    await waitFor(() => expect(mockStore.get).toHaveBeenCalledWith("direction"));

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().view.direction).toBe("rtl");
    expect(mockStore.set).toHaveBeenCalledWith("direction", "rtl");
  });

  it("should open settings window when button is clicked", async () => {
    renderWithProviders(<NavigationBar />);

    const settingsButton = screen.getByLabelText("settings");
    await user.click(settingsButton);

    expect(WebviewWindow).toHaveBeenCalledWith("settings", expect.anything());
  });
});
