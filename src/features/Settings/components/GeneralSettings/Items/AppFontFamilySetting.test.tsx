import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFonts } from "../../../../../bindings/FontCommands";
import { mockTauri } from "../../../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import AppFontFamilySetting from "./AppFontFamilySetting";

describe("AppFontFamilySetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
    vi.mocked(getFonts).mockResolvedValue(["Arial", "Times New Roman"]);
  });

  it("should render and load initial font from state", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.appFontFamily = "Arial";

    renderWithProviders(<AppFontFamilySetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("Arial");
    });
  });

  it("should update store and emit event when font is changed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.appFontFamily = "Default";

    renderWithProviders(<AppFontFamilySetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await user.click(select);

    const listbox = await screen.findByRole("listbox");
    const option = within(listbox).getByText("Times New Roman");
    await user.click(option);

    await waitFor(() => {
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { general: { appFontFamily: "Times New Roman" } },
      });
    });
  });

  it("should handle font list retrieval failure by falling back to default", async () => {
    vi.mocked(getFonts).mockRejectedValue(new Error("Failed to fetch fonts"));

    const preloadedState = createBasePreloadedState();
    const defaultFont = "Inter, Avenir, Helvetica, Arial, sans-serif";
    preloadedState.settings.general.appFontFamily = defaultFont;

    renderWithProviders(<AppFontFamilySetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      // The input value should be the translated label "Default"
      expect(screen.getByRole("combobox")).toHaveValue("Default");
    });

    await user.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(/Default/i);
  });
});
