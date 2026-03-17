import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../../../test/utils";
import FirstPageSetting from "./FirstPageSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("FirstPageSetting", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = {
    view: {
      isFirstPageSingleView: true,
      fontFamily: "",
      activeView: "bookshelf",
      isTwoPagedView: true,
      direction: "ltr",
      enablePreview: true,
      enableHistory: true,
      novel: { font: "default-font", fontSize: 18 },
    },
  } as unknown as RootState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    mockStore.get.mockResolvedValue(false);

    const { store } = renderWithProviders(<FirstPageSetting />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalledWith("first-page-single-view");
      expect(store.getState().view.isFirstPageSingleView).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    mockStore.get.mockResolvedValue(true);

    const { store } = renderWithProviders(<FirstPageSetting />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => expect(mockStore.get).toHaveBeenCalled());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    expect(store.getState().view.isFirstPageSingleView).toBe(false);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith("first-page-single-view", false);
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        view: { isFirstPageSingleView: false },
      });
    });
  });
});
