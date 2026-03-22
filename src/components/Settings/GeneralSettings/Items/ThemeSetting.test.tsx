import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import ThemeSetting from "./ThemeSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { app } from "@tauri-apps/api";

describe("ThemeSetting", () => {
  const user = userEvent.setup();

  const basePreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial theme from store", async () => {
    const preloadedState = {
      ...basePreloadedState,
      settings: {
        ...basePreloadedState.settings,
        theme: "dark" as const,
      },
    };

    renderWithProviders(<ThemeSetting />, { preloadedState });

    await waitFor(() => {
      // Check if Dark button is selected (aria-pressed is common for ToggleButton)
      const darkButton = screen.getByRole("button", { name: /dark/i });
      expect(darkButton).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("should update theme and store when a button is clicked", async () => {
    const preloadedState = {
      ...basePreloadedState,
      settings: {
        ...basePreloadedState.settings,
        theme: "system" as const,
      },
    };

    renderWithProviders(<ThemeSetting />, { preloadedState });

    const lightButton = screen.getByRole("button", { name: /light/i });
    await user.click(lightButton);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith("theme", "light");
      expect(app.setTheme).toHaveBeenCalledWith("light");
      expect(lightButton).toHaveAttribute("aria-pressed", "true");
    });
  });
});
