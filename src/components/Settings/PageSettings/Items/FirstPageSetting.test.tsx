import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import FirstPageSetting from "./FirstPageSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("FirstPageSetting", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const { store } = renderWithProviders(<FirstPageSetting />, {
      preloadedState: {
        ...defaultPreloadedState,
        settings: {
          ...defaultPreloadedState.settings,
          "first-page-single-view": false,
        },
      },
    });

    await waitFor(() => {
      expect(store.getState().settings["first-page-single-view"]).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const { store } = renderWithProviders(<FirstPageSetting />, {
      preloadedState: {
        ...defaultPreloadedState,
        settings: {
          ...defaultPreloadedState.settings,
          "first-page-single-view": true,
        },
      },
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings["first-page-single-view"]).toBe(false);
      expect(mockStore.set).toHaveBeenCalledWith("first-page-single-view", false);
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        view: { isFirstPageSingleView: false },
      });
    });
  });
});
