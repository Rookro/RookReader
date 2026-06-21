import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import AutoOpenAdjacentBookSetting from "./AutoOpenAdjacentBookSetting";

describe("AutoOpenAdjacentBookSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load the initial value from settings", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.autoOpenAdjacentBook = "auto";

    renderWithProviders(<AutoOpenAdjacentBookSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByText("Auto-open")).toBeInTheDocument();
    });
  });

  it("should update the store and emit an event when changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.autoOpenAdjacentBook = "off";

    const { store } = renderWithProviders(<AutoOpenAdjacentBookSetting />, { preloadedState });

    const select = screen.getByRole("combobox");
    await user.click(select);

    const option = await screen.findByRole("listbox");
    await user.click(within(option).getByRole("option", { name: "Ask before opening" }));

    await waitFor(() => {
      expect(store.getState().settings.reader.autoOpenAdjacentBook).toBe("ask");
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { autoOpenAdjacentBook: "ask" } },
      });
    });
  });
});
