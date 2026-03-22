import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import DirWatchSetting from "./DirWatchSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("DirWatchSetting", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = {
      ...defaultPreloadedState,
      settings: {
        ...defaultPreloadedState.settings,
        "enable-directory-watch": true,
      },
    };

    const { store } = renderWithProviders(<DirWatchSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      expect(store.getState().settings["enable-directory-watch"]).toBe(true);
    });

    // MUI Switch uses role="switch"
    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = {
      ...defaultPreloadedState,
      settings: {
        ...defaultPreloadedState.settings,
        "enable-directory-watch": false,
      },
    };

    const { store } = renderWithProviders(<DirWatchSetting />, {
      preloadedState,
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings["enable-directory-watch"]).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith("enable-directory-watch", true);
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        fileNavigator: { isDirWatchEnabled: true },
      });
    });
  });
});
