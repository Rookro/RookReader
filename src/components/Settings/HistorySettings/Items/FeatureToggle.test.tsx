import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../../../test/utils";
import FeatureToggle from "./FeatureToggle";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("FeatureToggle", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = {
    view: {
      enableHistory: true,
      fontFamily: "",
      activeView: "bookshelf",
      isTwoPagedView: true,
      direction: "ltr",
      isFirstPageSingleView: true,
      enablePreview: true,
      novel: { font: "default-font", fontSize: 18 },
    },
  } as unknown as RootState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    mockStore.get.mockResolvedValue({ enable: false });

    const { store } = renderWithProviders(<FeatureToggle />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalledWith("history");
      expect(store.getState().view.enableHistory).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    mockStore.get.mockResolvedValue({ enable: true });

    const { store } = renderWithProviders(<FeatureToggle />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => expect(mockStore.get).toHaveBeenCalled());

    const switchElement = screen.getByRole("switch");
    // Initially checked because preloadedState.view.enableHistory is true
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    expect(store.getState().view.enableHistory).toBe(false);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith("history", { enable: false });
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        history: { isEnabled: false },
      });
    });
  });
});
