import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import * as SettingsReducer from "../../Settings/slice";
import NavigationBar from "./NavigationBar";

describe("NavigationBar", () => {
  const user = userEvent.setup();

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
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1", "/path/2"];
    preloadedState.read.containerFile.historyIndex = 1;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    await user.click(backButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(0);
  });

  it("should disable back button if historyIndex <= 0", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1"];
    preloadedState.read.containerFile.historyIndex = 0;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    expect(backButton).toBeDisabled();
  });

  it("should toggle isTwoPagedView when button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.enableSpread = true;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const toggleButton = screen.getByLabelText("toggle-two-paged");
    await user.click(toggleButton);

    expect(store.getState().settings.reader.comic.enableSpread).toBe(false);
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "reader",
      value: expect.objectContaining({ comic: expect.objectContaining({ enableSpread: false }) }),
    });
  });

  it("should toggle direction when button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.readingDirection = "ltr" as const;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().settings.reader.comic.readingDirection).toBe("rtl");
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "reader",
      value: expect.objectContaining({
        comic: expect.objectContaining({ readingDirection: "rtl" }),
      }),
    });
  });

  it("should dispatch goForwardContainerHistory when forward button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1", "/path/2"];
    preloadedState.read.containerFile.historyIndex = 0;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    await user.click(forwardButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(1);
  });

  it("should disable forward button if historyIndex is at the end", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1"];
    preloadedState.read.containerFile.historyIndex = 0;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    renderWithProviders(<NavigationBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    expect(forwardButton).toBeDisabled();
  });

  it("should toggle direction from rtl to ltr when button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.readingDirection = "rtl" as const;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().settings.reader.comic.readingDirection).toBe("ltr");
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "reader",
      value: expect.objectContaining({
        comic: expect.objectContaining({ readingDirection: "ltr" }),
      }),
    });
  });

  it("should dispatch setContainerFilePath when path input is submitted", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/old"];
    preloadedState.read.containerFile.historyIndex = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const input = screen.getByLabelText("container-path-input");
    await user.clear(input);
    await user.type(input, "/path/new{enter}");

    expect(store.getState().read.containerFile.history).toContain("/path/new");
  });

  it("should trigger form submission on blur", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/old"];
    preloadedState.read.containerFile.historyIndex = 0;

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
