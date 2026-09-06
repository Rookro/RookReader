import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import PageReaderCountSetting from "./PageReaderCountSetting";

describe("PageReaderCountSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.pageReaderCount = 4;

    renderWithProviders(<PageReaderCountSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      const numericInput = screen.getByRole("textbox");
      expect(numericInput).toHaveValue("4");
    });
  });

  // 0 is the default and means "let the app choose", so it has to survive a round trip
  // rather than be treated as an empty field.
  it("should update store and emit event when value is changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.pageReaderCount = 0;

    const { store } = renderWithProviders(<PageReaderCountSetting />, {
      preloadedState,
    });

    const numericInput = await screen.findByRole("textbox");
    expect(numericInput).toHaveValue("0");

    await user.clear(numericInput);
    await user.type(numericInput, "2");
    await user.keyboard("{Enter}");
    numericInput.blur();

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.cache.pageReaderCount).toBe(2);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { cache: { pageReaderCount: 2 } } } },
      });
    });
  });
});
