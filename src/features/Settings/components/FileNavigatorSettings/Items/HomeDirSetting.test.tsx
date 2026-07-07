import { homeDir } from "@tauri-apps/api/path";
import * as dialog from "@tauri-apps/plugin-dialog";
import { error } from "@tauri-apps/plugin-log";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import HomeDirSetting from "./HomeDirSetting";

describe("HomeDirSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
    vi.mocked(homeDir).mockResolvedValue("/default/home");
  });

  it("should load initial home directory from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByDisplayValue("/saved/path")).toBeInTheDocument();
    });
  });

  it("should fallback to system home dir if store path is empty", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    await waitFor(() => {
      expect(homeDir).toHaveBeenCalled();
      expect(screen.getByDisplayValue("/default/home")).toBeInTheDocument();
    });
  });

  it("should update store when text input changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const input = await screen.findByDisplayValue("/saved/path");
    await user.clear(input);
    await user.type(input, "/manual/path");
    await user.tab(); // Blur trigger

    expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
      patch: { fileNavigator: { homeDirectory: "/manual/path" } },
    });
  });

  it("should not update store if text input has not changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const input = await screen.findByDisplayValue("/saved/path");
    await user.click(input);
    await user.tab(); // Blur trigger

    expect(mockTauri.invoke).not.toHaveBeenCalledWith("set_settings", expect.anything());
  });

  it("should open dialog and update store when folder button is clicked", async () => {
    vi.mocked(dialog.open).mockResolvedValue("/picked/path");
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const folderButton = screen.getByRole("button");
    await user.click(folderButton);

    expect(dialog.open).toHaveBeenCalledWith({ multiple: false, directory: true });

    await waitFor(() => {
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { fileNavigator: { homeDirectory: "/picked/path" } },
      });
      expect(screen.getByDisplayValue("/picked/path")).toBeInTheDocument();
    });
  });

  it("should do nothing when folder picker is cancelled", async () => {
    vi.mocked(dialog.open).mockResolvedValue(null);
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const folderButton = screen.getByRole("button");
    await user.click(folderButton);

    expect(dialog.open).toHaveBeenCalled();
    expect(mockTauri.invoke).not.toHaveBeenCalledWith("set_settings", expect.anything());
    expect(screen.getByDisplayValue("/saved/path")).toBeInTheDocument();
  });

  it("should log error when folder picker fails", async () => {
    vi.mocked(dialog.open).mockRejectedValue(new Error("Picker failed"));
    const preloadedState = createBasePreloadedState();

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const folderButton = screen.getByRole("button");
    await user.click(folderButton);

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Picker failed"));
    });
  });

  it("should stop propagation on context menu", async () => {
    const preloadedState = createBasePreloadedState();
    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const input = screen.getByRole("textbox");
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    vi.spyOn(event, "stopPropagation");

    fireEvent(input, event);

    expect(event.stopPropagation).toHaveBeenCalled();
  });
});
