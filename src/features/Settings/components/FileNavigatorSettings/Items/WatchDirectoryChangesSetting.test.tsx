import { emit } from "@tauri-apps/api/event";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStore } from "../../../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import WatchDirectoryChangesSetting from "./WatchDirectoryChangesSetting";

describe("WatchDirectoryChangesSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockStore.set).toHaveBeenCalledWith(
        "fileNavigator",
        expect.objectContaining({ watchDirectoryChanges: true }),
      );
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            fileNavigator: expect.objectContaining({ watchDirectoryChanges: true }),
          }),
        }),
      );
    });
  });
});
