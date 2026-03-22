import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import RestoreOnStartupSetting from "./RestoreOnStartupSetting";
import { mockStore } from "../../../../test/mocks/tauri";

describe("RestoreOnStartupSetting", () => {
  const user = userEvent.setup();

  const basePreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = {
      ...basePreloadedState,
      settings: {
        ...basePreloadedState.settings,
        history: {
          ...basePreloadedState.settings.history,
          "restore-last-container-on-startup": true,
        },
      },
    };

    renderWithProviders(<RestoreOnStartupSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  it("should update store when toggled", async () => {
    const preloadedState = {
      ...basePreloadedState,
      settings: {
        ...basePreloadedState.settings,
        history: {
          ...basePreloadedState.settings.history,
          "restore-last-container-on-startup": false,
        },
      },
    };

    renderWithProviders(<RestoreOnStartupSetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "history",
        expect.objectContaining({
          "restore-last-container-on-startup": true,
        }),
      );
    });
  });
});
