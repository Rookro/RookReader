import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import PdfRenderingSetting from "./PdfRenderingSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import * as containerCmds from "../../../../bindings/ContainerCommands";

// Mock ContainerCommands
describe("PdfRenderingSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial pdf rendering height from store", async () => {
    mockStore.get.mockResolvedValue({ "pdf-rendering-height": 3000 });

    renderWithProviders(<PdfRenderingSetting />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("3000")).toBeInTheDocument();
    });
  });

  it("should update store and call backend when height changes", async () => {
    mockStore.get.mockResolvedValue({ "pdf-rendering-height": 2000 });

    renderWithProviders(<PdfRenderingSetting />);

    const input = await screen.findByDisplayValue("2000");
    await user.clear(input);
    await user.type(input, "2500");

    await waitFor(() => {
      expect(containerCmds.setPdfRenderingHeight).toHaveBeenCalledWith(2500);
      expect(mockStore.set).toHaveBeenCalledWith(
        "rendering",
        expect.objectContaining({ "pdf-rendering-height": 2500 }),
      );
    });
  });

  it("should show error message for height < 1", async () => {
    mockStore.get.mockResolvedValue({ "pdf-rendering-height": 2000 });

    renderWithProviders(<PdfRenderingSetting />);

    const input = await screen.findByDisplayValue("2000");
    await user.clear(input);
    await user.type(input, "0");

    // English: "Please enter a positive integer."
    expect(screen.getByText(/Please enter a positive integer/i)).toBeInTheDocument();
    expect(containerCmds.setPdfRenderingHeight).not.toHaveBeenCalledWith(0);
  });
});
