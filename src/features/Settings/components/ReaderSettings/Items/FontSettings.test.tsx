import { emit } from "@tauri-apps/api/event";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFonts } from "../../../../../bindings/FontCommands";
import { mockStore } from "../../../../../test/mocks/tauri";
import { renderWithProviders } from "../../../../../test/utils";
import FontSettings from "./FontSettings";

describe("FontSettings", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFonts).mockResolvedValue(["Arial", "Times New Roman"]);
  });

  it("should load initial font settings from store", async () => {
    renderWithProviders(<FontSettings />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("Default");
      // NumberSpinner has two inputs with same value, we pick the visible one
      expect(screen.getAllByDisplayValue("16")[0]).toBeInTheDocument();
    });
  });

  it("should update store and emit event when font is changed", async () => {
    renderWithProviders(<FontSettings />);

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await user.click(select);

    const listbox = await screen.findByRole("listbox");
    const option = within(listbox).getByText("Arial");
    await user.click(option);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({ novel: expect.objectContaining({ fontFamily: "Arial" }) }),
      );
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            reader: expect.objectContaining({
              novel: expect.objectContaining({ fontFamily: "Arial" }),
            }),
          }),
        }),
      );
    });
  });

  it("should update store and emit event when font size is changed", async () => {
    renderWithProviders(<FontSettings />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "24");
    await user.tab();

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({ novel: expect.objectContaining({ fontSize: 24 }) }),
      );
      expect(emit).toHaveBeenCalledWith(
        "settings-changed",
        expect.objectContaining({
          appSettings: expect.objectContaining({
            reader: expect.objectContaining({
              novel: expect.objectContaining({ fontSize: 24 }),
            }),
          }),
        }),
      );
    });
  });
});
