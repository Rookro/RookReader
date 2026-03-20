import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import ImageResizeMethodSetting from "./ImageResizeMethodSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import * as containerCmds from "../../../../bindings/ContainerCommands";

// Mock ContainerCommands
describe("ImageResizeMethodSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial resize method from store", async () => {
    mockStore.get.mockResolvedValue({ "image-resize-method": "lanczos3" });

    renderWithProviders(<ImageResizeMethodSetting />);

    await waitFor(() => {
      // English: "Lanczos 3 (Slow / Best Quality)"
      expect(screen.getByRole("combobox")).toHaveTextContent(/Lanczos 3/i);
    });
  });

  it("should update store and call backend when resize method changes", async () => {
    mockStore.get.mockResolvedValue({ "image-resize-method": "triangle" });

    renderWithProviders(<ImageResizeMethodSetting />);

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await user.click(select);

    const listbox = await screen.findByRole("listbox");
    // English: "Nearest Neighbor (Fastest / Low Quality)"
    const option = within(listbox).getByText(/Nearest Neighbor/i);
    await user.click(option);

    await waitFor(() => {
      expect(containerCmds.setImageResizeMethod).toHaveBeenCalledWith("nearest");
      expect(mockStore.set).toHaveBeenCalledWith(
        "rendering",
        expect.objectContaining({ "image-resize-method": "nearest" }),
      );
    });
  });
});
