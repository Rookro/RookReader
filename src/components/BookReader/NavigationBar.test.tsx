import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import NavigationBar from "./NavigationBar";
import { mockStore } from "../../test/mocks/tauri";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

describe("NavigationBar", () => {
  const user = userEvent.setup();

  const basePreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should dispatch setActiveView('bookshelf') when library button is clicked", async () => {
    const { store } = renderWithProviders(<NavigationBar />);

    const libraryButton = screen.getByRole("button", { name: "library" });
    await user.click(libraryButton);

    expect(store.getState().view.activeView).toBe("bookshelf");
  });

  it("should dispatch goBackContainerHistory when back button is clicked", async () => {
    const preloadedState = {
      read: {
        ...basePreloadedState.read,
        containerFile: {
          ...basePreloadedState.read.containerFile,
          history: ["/path/1", "/path/2"],
          historyIndex: 1,
          entries: [],
          index: 0,
        },
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    await user.click(backButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(0);
  });

  it("should disable back button if historyIndex <= 0", () => {
    const preloadedState = {
      read: {
        ...basePreloadedState.read,
        containerFile: {
          ...basePreloadedState.read.containerFile,
          history: ["/path/1"],
          historyIndex: 0,
          entries: [],
          index: 0,
        },
      },
    };

    renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    expect(backButton).toBeDisabled();
  });

  it("should toggle isTwoPagedView when button is clicked", async () => {
    const preloadedState = {
      view: {
        ...basePreloadedState.view,
        isTwoPagedView: true,
        direction: "ltr" as const,
        activeView: "reader" as const,
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const toggleButton = screen.getByLabelText("toggle-two-paged");
    await user.click(toggleButton);

    expect(store.getState().view.isTwoPagedView).toBe(false);
    expect(mockStore.set).toHaveBeenCalledWith("two-paged", false);
  });

  it("should toggle direction when button is clicked", async () => {
    const preloadedState = {
      view: {
        ...basePreloadedState.view,
        isTwoPagedView: true,
        direction: "ltr" as const,
        activeView: "reader" as const,
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

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
