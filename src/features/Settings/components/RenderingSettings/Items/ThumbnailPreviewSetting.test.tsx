import { emit } from "@tauri-apps/api/event";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStore } from "../../../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import ThumbnailPreviewSetting from "./ThumbnailPreviewSetting";

describe("ThumbnailPreviewSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({
          rendering: expect.objectContaining({ enableThumbnailPreview: false }),
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            reader: expect.objectContaining({
              rendering: expect.objectContaining({ enableThumbnailPreview: false }),
            }),
          }),
        }),
      );
    });
  });
});
