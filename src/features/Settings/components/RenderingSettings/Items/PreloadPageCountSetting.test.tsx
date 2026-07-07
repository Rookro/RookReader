import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import PreloadPageCountSetting from "./PreloadPageCountSetting";

describe("PreloadPageCountSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.preloadPageCount = 15;

    renderWithProviders(<PreloadPageCountSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      const numericInput = screen.getByRole("textbox");
      expect(numericInput).toHaveValue("15");
    });
  });

  it("should update store and emit event when value is changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.preloadPageCount = 10;

    const { store } = renderWithProviders(<PreloadPageCountSetting />, {
      preloadedState,
    });

    const numericInput = await screen.findByRole("textbox");
    expect(numericInput).toHaveValue("10");

    await user.clear(numericInput);
    await user.type(numericInput, "20");
    await user.keyboard("{Enter}");
    numericInput.blur();

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.cache.preloadPageCount).toBe(20);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { cache: { preloadPageCount: 20 } } } },
      });
    });
  });
});
