import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import { setSettings } from "../../../slice";
import RecordReadingHistorySetting from "./RecordReadingHistorySetting";

describe("RecordReadingHistorySetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
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
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { history: { recordReadingHistory: false } },
      });
    });
  });

  it("should reflect an external settings change after mount (controlled input)", async () => {
    const preloadedState = structuredClone(createBasePreloadedState());
    preloadedState.settings.history.recordReadingHistory = true;

    const { store } = renderWithProviders(<RecordReadingHistorySetting />, {
      preloadedState,
    });

    expect(screen.getByRole("switch")).toBeChecked();

    // Simulate a cross-window `settings-changed` broadcast re-hydrating the slice.
    act(() => {
      const current = store.getState().settings;
      store.dispatch(
        setSettings({
          ...current,
          history: { ...current.history, recordReadingHistory: false },
        }),
      );
    });

    await waitFor(() => expect(screen.getByRole("switch")).not.toBeChecked());
  });
});
