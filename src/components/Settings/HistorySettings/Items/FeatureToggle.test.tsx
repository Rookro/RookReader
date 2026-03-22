import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import FeatureToggle from "./FeatureToggle";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("FeatureToggle", () => {
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
        history: {
          enable: false,
          "restore-last-container-on-startup": true,
        },
      },
    };

    const { store } = renderWithProviders(<FeatureToggle />, {
      preloadedState,
    });

    await waitFor(() => {
      expect(store.getState().settings.history.enable).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = {
      ...defaultPreloadedState,
      settings: {
        ...defaultPreloadedState.settings,
        history: {
          enable: true,
          "restore-last-container-on-startup": true,
        },
      },
    };

    const { store } = renderWithProviders(<FeatureToggle />, {
      preloadedState,
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    // Initially checked because preloadedState.settings.history.enable is true
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings.history.enable).toBe(false);
      expect(mockStore.set).toHaveBeenCalledWith(
        "history",
        expect.objectContaining({ enable: false }),
      );
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        history: { isEnabled: false },
      });
    });
  });
});
