import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import RestoreLastBookSetting from "./RestoreLastBookSetting";
import { mockStore } from "../../../../test/mocks/tauri";

describe("RestoreLastBookSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.startup.restoreLastBook = true;

    renderWithProviders(<RestoreLastBookSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  it("should update store when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.startup.restoreLastBook = false;

    renderWithProviders(<RestoreLastBookSetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "startup",
        expect.objectContaining({
          restoreLastBook: true,
        }),
      );
    });
  });
});
