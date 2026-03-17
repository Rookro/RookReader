import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import ThemeSetting from "./ThemeSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { app } from "@tauri-apps/api";

describe("ThemeSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial theme from store", async () => {
    mockStore.get.mockResolvedValue("dark");

    renderWithProviders(<ThemeSetting />);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalledWith("theme");
    });

    // Check if Dark button is selected (aria-pressed is common for ToggleButton)
    const darkButton = screen.getByRole("button", { name: /dark/i });
    expect(darkButton).toHaveAttribute("aria-pressed", "true");
  });

  it("should update theme and store when a button is clicked", async () => {
    mockStore.get.mockResolvedValue("system");

    renderWithProviders(<ThemeSetting />);

    await waitFor(() => expect(mockStore.get).toHaveBeenCalled());

    const lightButton = screen.getByRole("button", { name: /light/i });
    await user.click(lightButton);

    expect(mockStore.set).toHaveBeenCalledWith("theme", "light");
    expect(app.setTheme).toHaveBeenCalledWith("light");
    expect(lightButton).toHaveAttribute("aria-pressed", "true");
  });
});
