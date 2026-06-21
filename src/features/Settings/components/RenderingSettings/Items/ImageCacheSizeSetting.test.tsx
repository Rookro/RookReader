import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import ImageCacheSizeSetting from "./ImageCacheSizeSetting";

describe("ImageCacheSizeSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.imageCacheSizeMib = 2048;

    renderWithProviders(<ImageCacheSizeSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      const numericInput = screen.getByRole("textbox");
      expect(numericInput).toHaveValue("2,048");
    });
  });

  it("should persist the change via set_settings when value is changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.imageCacheSizeMib = 1024;

    const { store } = renderWithProviders(<ImageCacheSizeSetting />, {
      preloadedState,
    });

    const numericInput = await screen.findByRole("textbox");
    expect(numericInput).toHaveValue("1,024");

    await user.clear(numericInput);
    await user.type(numericInput, "2048");
    await user.keyboard("{Enter}");
    numericInput.blur();

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.cache.imageCacheSizeMib).toBe(2048);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { cache: { imageCacheSizeMib: 2048 } } } },
      });
    });
  });
});
