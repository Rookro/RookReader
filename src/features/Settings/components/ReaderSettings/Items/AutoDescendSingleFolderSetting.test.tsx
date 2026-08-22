import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import AutoDescendSingleFolderSetting from "./AutoDescendSingleFolderSetting";

describe("AutoDescendSingleFolderSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load initial state from settingsStore", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.autoDescendSingleFolder = false;

    const { store } = renderWithProviders(<AutoDescendSingleFolderSetting />, {
      preloadedState,
    });

    await waitFor(() => {
      expect(store.getState().settings.reader.autoDescendSingleFolder).toBe(false);
    });

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
  });

  it("should update store and emit event when toggled", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.autoDescendSingleFolder = true;

    const { store } = renderWithProviders(<AutoDescendSingleFolderSetting />, {
      preloadedState,
    });

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeChecked();

    await user.click(switchElement);

    await waitFor(() => {
      expect(store.getState().settings.reader.autoDescendSingleFolder).toBe(false);
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { autoDescendSingleFolder: false } },
      });
    });
  });
});
