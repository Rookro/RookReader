import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import NavigationBar from "./NavigationBar";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as SettingsReducer from "../../reducers/SettingsReducer";

describe("NavigationBar", () => {
  const user = userEvent.setup();
  const basePreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SettingsReducer, "updateSettings");
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
      ...basePreloadedState,
      view: {
        ...basePreloadedState.view,
        activeView: "reader" as const,
      },
      settings: {
        ...basePreloadedState.settings,
        "two-paged": true,
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const toggleButton = screen.getByLabelText("toggle-two-paged");
    await user.click(toggleButton);

    expect(store.getState().settings["two-paged"]).toBe(false);
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "two-paged",
      value: false,
    });
  });

  it("should toggle direction when button is clicked", async () => {
    const preloadedState = {
      ...basePreloadedState,
      view: {
        ...basePreloadedState.view,
        activeView: "reader" as const,
      },
      settings: {
        ...basePreloadedState.settings,
        "two-paged": true,
        direction: "ltr" as const,
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().settings.direction).toBe("rtl");
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "direction",
      value: "rtl",
    });
  });

  it("should dispatch goForwardContainerHistory when forward button is clicked", async () => {
    const preloadedState = {
      read: {
        ...basePreloadedState.read,
        containerFile: {
          ...basePreloadedState.read.containerFile,
          history: ["/path/1", "/path/2"],
          historyIndex: 0,
          entries: [],
          index: 0,
        },
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    await user.click(forwardButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(1);
  });

  it("should disable forward button if historyIndex is at the end", () => {
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

    const forwardButton = screen.getByLabelText("forward");
    expect(forwardButton).toBeDisabled();
  });

  it("should toggle direction from rtl to ltr when button is clicked", async () => {
    const preloadedState = {
      ...basePreloadedState,
      view: {
        ...basePreloadedState.view,
        activeView: "reader" as const,
      },
      settings: {
        ...basePreloadedState.settings,
        direction: "rtl" as const,
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().settings.direction).toBe("ltr");
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "direction",
      value: "ltr",
    });
  });

  it("should dispatch setContainerFilePath when path input is submitted", async () => {
    const preloadedState = {
      read: {
        ...basePreloadedState.read,
        containerFile: {
          ...basePreloadedState.read.containerFile,
          history: ["/path/old"],
          historyIndex: 0,
        },
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const input = screen.getByLabelText("container-path-input");
    await user.clear(input);
    await user.type(input, "/path/new{enter}");

    expect(store.getState().read.containerFile.history).toContain("/path/new");
  });

  it("should trigger form submission on blur", async () => {
    const preloadedState = {
      read: {
        ...basePreloadedState.read,
        containerFile: {
          ...basePreloadedState.read.containerFile,
          history: ["/path/old"],
          historyIndex: 0,
        },
      },
    };

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const input = screen.getByLabelText("container-path-input");
    await user.clear(input);
    await user.type(input, "/path/blur");
    await user.tab(); // Trigger blur

    expect(store.getState().read.containerFile.history).toContain("/path/blur");
  });

  it("should prevent context menu propagation on input", () => {
    renderWithProviders(<NavigationBar />);

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    screen.getByLabelText("container-path-input").dispatchEvent(event);

    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("should open settings window when button is clicked", async () => {
    renderWithProviders(<NavigationBar />);

    const settingsButton = screen.getByLabelText("settings");
    await user.click(settingsButton);

    expect(WebviewWindow).toHaveBeenCalledWith("settings", expect.anything());
  });
});
