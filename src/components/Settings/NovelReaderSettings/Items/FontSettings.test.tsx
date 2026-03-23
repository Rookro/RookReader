import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import FontSettings from "./FontSettings";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";
import { getFonts } from "../../../../bindings/FontCommands";

// Mock FontCommands
describe("FontSettings", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFonts).mockResolvedValue(["Arial", "Times New Roman"]);
  });

  it("should load initial font settings from store", async () => {
    renderWithProviders(<FontSettings />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("Default");
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

    // Base UI renders a hidden input for form submission and a visible textbox for interaction.
    // Use the textbox to allow userEvent.clear and userEvent.type to work.
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "24");
    await user.tab(); // Blur trigger

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
