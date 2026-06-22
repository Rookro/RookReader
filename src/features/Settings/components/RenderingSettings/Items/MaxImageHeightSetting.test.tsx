import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import MaxImageHeightSetting from "./MaxImageHeightSetting";

describe("MaxImageHeightSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial height from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.maxImageHeight = 1500;

    renderWithProviders(<MaxImageHeightSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByDisplayValue("1,500")).toBeInTheDocument();
    });
  });

  it("should persist the change via set_settings when input changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.maxImageHeight = 0;

    renderWithProviders(<MaxImageHeightSetting />, { preloadedState });

    // Base UI renders a hidden input for form submission and a visible textbox for interaction.
    // Use the textbox to allow userEvent.clear and userEvent.type to work.
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2000");
    await user.tab(); // Blur trigger

    await waitFor(() => {
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { rendering: { maxImageHeight: 2000 } } },
      });
    });
  });
});
