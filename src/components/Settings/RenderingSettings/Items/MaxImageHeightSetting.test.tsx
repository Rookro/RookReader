import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import MaxImageHeightSetting from "./MaxImageHeightSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import * as containerCmds from "../../../../bindings/ContainerCommands";

// Mock ContainerCommands
describe("MaxImageHeightSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial height from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.maxImageHeight = 1500;

    renderWithProviders(<MaxImageHeightSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByDisplayValue("1,500")).toBeInTheDocument();
    });
  });

  it("should update store and call backend when input changes", async () => {
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
      expect(containerCmds.setMaxImageHeight).toHaveBeenCalledWith(2000);
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({ rendering: expect.objectContaining({ maxImageHeight: 2000 }) }),
      );
    });
  });

  it("should display error message when backend call fails", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.maxImageHeight = 0;
    vi.mocked(containerCmds.setMaxImageHeight).mockRejectedValueOnce(new Error("Backend error"));

    renderWithProviders(<MaxImageHeightSetting />, { preloadedState });

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2000");
    await user.tab(); // Blur trigger

    await waitFor(() => {
      expect(containerCmds.setMaxImageHeight).toHaveBeenCalledWith(2000);
      expect(screen.getByText(/Failed to set max image height/i)).toBeInTheDocument();
      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });
});
