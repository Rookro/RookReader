import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStore } from "../../../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import CheckUpdateOnStartupSetting from "./CheckUpdateOnStartupSetting";

describe("CheckUpdateOnStartupSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.startup.checkUpdateOnStartup = true;

    renderWithProviders(<CheckUpdateOnStartupSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  it("should update store when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.startup.checkUpdateOnStartup = false;

    renderWithProviders(<CheckUpdateOnStartupSetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "startup",
        expect.objectContaining({
          checkUpdateOnStartup: true,
        }),
      );
    });
  });
});
