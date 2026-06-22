import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import ShowCoverAsSinglePageSetting from "./ShowCoverAsSinglePageSetting";

describe("FirstPageSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.showCoverAsSinglePage = false;

    const { store } = renderWithProviders(<ShowCoverAsSinglePageSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.showCoverAsSinglePage).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.showCoverAsSinglePage = true;

    const { store } = renderWithProviders(<ShowCoverAsSinglePageSetting />, {
      preloadedState,
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.showCoverAsSinglePage).toBe(false);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { showCoverAsSinglePage: false } } },
      });
    });
  });
});
