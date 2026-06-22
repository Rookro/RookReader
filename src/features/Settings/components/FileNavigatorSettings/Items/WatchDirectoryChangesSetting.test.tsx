import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import WatchDirectoryChangesSetting from "./WatchDirectoryChangesSetting";

describe("WatchDirectoryChangesSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.watchDirectoryChanges = true;

    const { store } = renderWithProviders(<WatchDirectoryChangesSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      expect(store.getState().settings.fileNavigator.watchDirectoryChanges).toBe(true);
    });

    // MUI Switch uses role="switch"
    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.watchDirectoryChanges = false;

    const { store } = renderWithProviders(<WatchDirectoryChangesSetting />, {
      preloadedState,
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings.fileNavigator.watchDirectoryChanges).toBe(true);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { fileNavigator: { watchDirectoryChanges: true } },
      });
    });
  });
});
