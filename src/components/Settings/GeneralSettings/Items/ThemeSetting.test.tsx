import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import ThemeSetting from "./ThemeSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { app } from "@tauri-apps/api";

describe("ThemeSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial theme from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.theme = "dark";

    renderWithProviders(<ThemeSetting />, { preloadedState });

    await waitFor(() => {
      // Check if Dark button is selected (aria-pressed is common for ToggleButton)
      const darkButton = screen.getByRole("button", { name: /dark/i });
      expect(darkButton).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("should update theme and store when a button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.theme = "system";

    renderWithProviders(<ThemeSetting />, { preloadedState });

    const lightButton = screen.getByRole("button", { name: /light/i });
    await user.click(lightButton);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "general",
        expect.objectContaining({ theme: "light" }),
      );
      expect(app.setTheme).toHaveBeenCalledWith("light");
      expect(lightButton).toHaveAttribute("aria-pressed", "true");
    });
  });
});
