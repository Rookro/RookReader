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

    // Base UI renders a hidden input for form submission and a visible textbox for interaction.
    // Use the textbox to allow userEvent.clear and userEvent.type to work.
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2500");
    await user.tab(); // Blur trigger

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

    // Likewise, target the textbox instead of the hidden input
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "0");
    await user.tab(); // Blur trigger

    expect(screen.getByText(/Please enter a positive integer/i)).toBeInTheDocument();
    expect(containerCmds.setPdfRenderingHeight).not.toHaveBeenCalledWith(0);
  });

  it("should display error message when backend call fails", async () => {
    mockStore.get.mockResolvedValue({ "pdf-rendering-height": 2000 });
    vi.mocked(containerCmds.setPdfRenderingHeight).mockRejectedValueOnce(
      new Error("Backend error"),
    );

    renderWithProviders(<PdfRenderingSetting />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2500");
    await user.tab(); // Blur trigger

    await waitFor(() => {
      expect(containerCmds.setPdfRenderingHeight).toHaveBeenCalledWith(2500);
      expect(screen.getByText(/Failed to set PDF rendering height/i)).toBeInTheDocument();
      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });
});
