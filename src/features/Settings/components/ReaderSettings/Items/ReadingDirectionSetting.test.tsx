import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import ReadingDirectionSetting from "./ReadingDirectionSetting";

describe("ReadingDirectionSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should load the initial value from settings", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.readingDirection = "ltr";

    renderWithProviders(<ReadingDirectionSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByText("Left to right")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ReadingDirection-ltr")).toBeInTheDocument();
  });

  it("should update the store and emit an event when changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.readingDirection = "rtl";

    const { store } = renderWithProviders(<ReadingDirectionSetting />, { preloadedState });

    const select = screen.getByRole("combobox");
    await user.click(select);

    const options = await screen.findByRole("listbox");
    await user.click(within(options).getByRole("option", { name: "Left to right" }));

    await waitFor(() => {
      expect(store.getState().settings.reader.comic.readingDirection).toBe("ltr");
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { readingDirection: "ltr" } } },
      });
    });
  });
});
