import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setImageCacheSizeMib } from "../../../../../bindings/ContainerCommands";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import ImageCacheSizeSetting from "./ImageCacheSizeSetting";

vi.mock("../../../../../bindings/ContainerCommands", () => ({
  setImageCacheSizeMib: vi.fn(),
}));

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

  it("should update store, call backend and emit event when value is changed", async () => {
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
      expect(setImageCacheSizeMib).toHaveBeenCalledWith(2048);
      expect(store.getState().settings.reader.comic.cache.imageCacheSizeMib).toBe(2048);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { cache: { imageCacheSizeMib: 2048 } } } },
      });
    });
  });

  it("should show error message if backend call fails", async () => {
    vi.mocked(setImageCacheSizeMib).mockRejectedValueOnce(new Error("Backend Error"));

    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.cache.imageCacheSizeMib = 1024;

    renderWithProviders(<ImageCacheSizeSetting />, {
      preloadedState,
    });

    const numericInput = await screen.findByRole("textbox");

    await user.clear(numericInput);
    await user.type(numericInput, "-1");
    await user.keyboard("{Enter}");
    numericInput.blur();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to set image cache size. Please check your input."),
      ).toBeInTheDocument();
    });
  });
});
