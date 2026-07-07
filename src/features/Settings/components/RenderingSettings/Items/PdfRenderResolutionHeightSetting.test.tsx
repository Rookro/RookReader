import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import { ErrorCode } from "../../../../../types/Error";
import PdfRenderResolutionHeightSetting from "./PdfRenderResolutionHeightSetting";

describe("PdfRenderResolutionHeightSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial pdf rendering height from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.pdfRenderResolutionHeight = 3000;

    renderWithProviders(<PdfRenderResolutionHeightSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByDisplayValue("3,000")).toBeInTheDocument();
    });
  });

  it("should update store and call backend when height changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.pdfRenderResolutionHeight = 2000;

    renderWithProviders(<PdfRenderResolutionHeightSetting />, { preloadedState });

    // Base UI renders a hidden input for form submission and a visible textbox for interaction.
    // Use the textbox to allow userEvent.clear and userEvent.type to work.
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2500");
    await user.tab(); // Blur trigger

    await waitFor(() => {
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { rendering: { pdfRenderResolutionHeight: 2500 } } },
      });
    });
  });

  it("commits the current in-range value (not 0) when the field is cleared", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.pdfRenderResolutionHeight = 3000;

    renderWithProviders(<PdfRenderResolutionHeightSetting />, { preloadedState });

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.tab(); // Blur with an empty field

    await waitFor(() => {
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { rendering: { pdfRenderResolutionHeight: 3000 } } },
      });
    });
    // The cleared field must never commit 0 (below the min of 1).
    expect(mockTauri.invoke).not.toHaveBeenCalledWith("set_settings", {
      patch: { reader: { rendering: { pdfRenderResolutionHeight: 0 } } },
    });
  });

  it("shows the backend's structured out-of-range message inline below the field", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.pdfRenderResolutionHeight = 2000;

    // The backend rejects an out-of-range value with a structured violation.
    mockTauri.invoke.mockImplementation((command: string) => {
      if (command === "set_settings") {
        return Promise.reject({
          code: ErrorCode.settingsValidation,
          message: "Settings validation failed",
          details: [
            {
              path: "reader.rendering.pdfRenderResolutionHeight",
              kind: "outOfRange",
              min: 1,
              max: 20000,
            },
          ],
        });
      }
      return Promise.resolve(undefined);
    });

    renderWithProviders(<PdfRenderResolutionHeightSetting />, { preloadedState });

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "50000");
    await user.tab(); // Blur trigger

    await waitFor(() => {
      expect(screen.getByText(/must be between 1 and 20000/i)).toBeInTheDocument();
    });
  });
});
