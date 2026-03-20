import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../test/utils";
import MaxImageHeightSetting from "./MaxImageHeightSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import * as containerCmds from "../../../../bindings/ContainerCommands";

// Mock ContainerCommands
describe("MaxImageHeightSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial height from store", async () => {
    mockStore.get.mockResolvedValue({ "max-image-height": 1500 });

    renderWithProviders(<MaxImageHeightSetting />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("1500")).toBeInTheDocument();
    });
  });

  it("should update store and call backend when input changes", async () => {
    mockStore.get.mockResolvedValue({ "max-image-height": 0 });

    renderWithProviders(<MaxImageHeightSetting />);

    const input = await screen.findByDisplayValue("0");
    // Use fireEvent.change for atomic update
    fireEvent.change(input, { target: { value: "2000" } });

    expect(containerCmds.setMaxImageHeight).toHaveBeenCalledWith(2000);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalled();
    });
  });

  it("should show error message for negative values", async () => {
    mockStore.get.mockResolvedValue({ "max-image-height": 0 });

    renderWithProviders(<MaxImageHeightSetting />);

    const input = await screen.findByDisplayValue("0");
    // Use fireEvent.change
    fireEvent.change(input, { target: { value: "-100" } });

    // Use translated string: "Please enter an integer of 0 or greater."
    expect(screen.getByText(/Please enter an integer of 0 or greater/i)).toBeInTheDocument();
    expect(containerCmds.setMaxImageHeight).not.toHaveBeenCalledWith(-100);
  });
});
