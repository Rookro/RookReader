import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../../../test/utils";
import DirWatchSetting from "./DirWatchSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("DirWatchSetting", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = {
    read: {
      explorer: {
        isWatchEnabled: false,
        history: [],
        historyIndex: -1,
        entries: [],
        searchText: "",
        sortOrder: "name-asc",
        isLoading: false,
        error: null,
      },
    },
  } as unknown as RootState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    mockStore.get.mockResolvedValue(true);

    const { store } = renderWithProviders(<DirWatchSetting />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalledWith("enable-directory-watch");
      expect(store.getState().read.explorer.isWatchEnabled).toBe(true);
    });

    // MUI Switch uses role="switch"
    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    mockStore.get.mockResolvedValue(false);

    const { store } = renderWithProviders(<DirWatchSetting />, {
      preloadedState: defaultPreloadedState,
    });

    await waitFor(() => expect(mockStore.get).toHaveBeenCalled());

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    expect(store.getState().read.explorer.isWatchEnabled).toBe(true);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith("enable-directory-watch", true);
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        fileNavigator: { isDirWatchEnabled: true },
      });
    });
  });
});
