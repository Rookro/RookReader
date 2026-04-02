import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import ShowCoverAsSinglePageSetting from "./ShowCoverAsSinglePageSetting";
import { mockStore } from "../../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("FirstPageSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({
          comic: expect.objectContaining({ showCoverAsSinglePage: false }),
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            reader: expect.objectContaining({
              comic: expect.objectContaining({ showCoverAsSinglePage: false }),
            }),
          }),
        }),
      );
    });
  });
});
