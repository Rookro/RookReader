import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import ThumbnailPreviewSetting from "./ThumbnailPreviewSetting";

describe("ThumbnailPreviewSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.enableThumbnailPreview = true;

    renderWithProviders(<ThumbnailPreviewSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.enableThumbnailPreview = true;

    renderWithProviders(<ThumbnailPreviewSetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    await waitFor(() => {
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { rendering: { enableThumbnailPreview: false } } },
      });
    });
  });
});
