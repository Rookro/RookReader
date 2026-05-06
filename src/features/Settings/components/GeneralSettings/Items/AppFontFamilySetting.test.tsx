import { emit } from "@tauri-apps/api/event";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFonts } from "../../../../../bindings/FontCommands";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import AppFontFamilySetting from "./AppFontFamilySetting";

describe("AppFontFamilySetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFonts).mockResolvedValue(["Arial", "Times New Roman"]);
  });

  it("should render and load initial font from state", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.appFontFamily = "Arial";

    renderWithProviders(<AppFontFamilySetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Arial");
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
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            general: expect.objectContaining({ appFontFamily: "Times New Roman" }),
          }),
        }),
      );
    });
  });

  it("should handle font list retrieval failure by falling back to default", async () => {
    // Note: The component itself doesn't have explicit error handling logic in the catch block
    // of getFonts(), but we want to verify it doesn't crash and still shows the default option.
    vi.mocked(getFonts).mockRejectedValue(new Error("Failed to fetch fonts"));

    const preloadedState = createBasePreloadedState();
    // Default value in slice is usually "Inter, Avenir, Helvetica, Arial, sans-serif"
    const defaultFont = "Inter, Avenir, Helvetica, Arial, sans-serif";
    preloadedState.settings.general.appFontFamily = defaultFont;

    renderWithProviders(<AppFontFamilySetting />, { preloadedState });

    await waitFor(() => {
      // The default option should be present and selected
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      // "Default" is the translated text for the defaultFont value
      expect(screen.getByRole("combobox")).toHaveTextContent(/Default/i);
    });

    // Open menu to verify no other fonts are listed
    await user.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");

    // Should only contain the "Default" option
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(/Default/i);
  });
});
