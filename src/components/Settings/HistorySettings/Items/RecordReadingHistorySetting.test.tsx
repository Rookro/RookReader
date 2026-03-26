import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import RecordReadingHistorySetting from "./RecordReadingHistorySetting";
import { emit } from "@tauri-apps/api/event";
import { mockStore } from "../../../../test/mocks/tauri";

describe("RecordReadingHistorySetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = structuredClone(createBasePreloadedState());
    preloadedState.settings.history.recordReadingHistory = false;

    const { store } = renderWithProviders(<RecordReadingHistorySetting />, {
      preloadedState,
    });

    await waitFor(() => {
      expect(store.getState().settings.history.recordReadingHistory).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = structuredClone(createBasePreloadedState());
    preloadedState.settings.history.recordReadingHistory = true;

    const { store } = renderWithProviders(<RecordReadingHistorySetting />, {
      preloadedState,
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    // Initially checked because preloadedState.settings.history.enable is true
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings.history.recordReadingHistory).toBe(false);
      expect(mockStore.set).toHaveBeenCalledWith(
        "history",
        expect.objectContaining({ recordReadingHistory: false }),
      );
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            history: expect.objectContaining({ recordReadingHistory: false }),
          }),
        }),
      );
    });
  });
});
