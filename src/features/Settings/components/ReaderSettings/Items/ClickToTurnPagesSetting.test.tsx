import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import ClickToTurnPagesSetting from "./ClickToTurnPagesSetting";

describe("ClickToTurnPagesSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("shows the stored mode", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.clickToTurnPages = "bySide";

    renderWithProviders(<ClickToTurnPagesSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByText("By side of the page")).toBeInTheDocument();
    });
  });

  it("saves the chosen mode", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.clickToTurnPages = "anywhere";

    const { store } = renderWithProviders(<ClickToTurnPagesSetting />, { preloadedState });

    await user.click(screen.getByRole("combobox"));

    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByRole("option", { name: "By side of the page" }));

    await waitFor(() => {
      expect(store.getState().settings.reader.clickToTurnPages).toBe("bySide");
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { clickToTurnPages: "bySide" } },
      });
    });
  });
});
