import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as containerCmds from "../../../../../bindings/ContainerCommands";
import { mockStore } from "../../../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import ImageResamplingMethodSetting from "./ImageResamplingMethodSetting";

// Mock ContainerCommands
describe("ImageResamplingMethodSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial resize method from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.imageResamplingMethod = "lanczos3" as const;

    renderWithProviders(<ImageResamplingMethodSetting />, { preloadedState });

    await waitFor(() => {
      // English: "Lanczos 3 (Slow / Best Quality)"
      expect(screen.getByRole("combobox")).toHaveTextContent(/Lanczos 3/i);
    });
  });

  it("should update store and call backend when resize method changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.rendering.imageResamplingMethod = "bilinear" as const;

    renderWithProviders(<ImageResamplingMethodSetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await user.click(select);

    const listbox = await screen.findByRole("listbox");
    // English: "Nearest Neighbor (Fastest / Low Quality)"
    const option = within(listbox).getByText(/Nearest Neighbor/i);
    await user.click(option);

    await waitFor(() => {
      expect(containerCmds.setImageResamplingMethod).toHaveBeenCalledWith("nearest");
      expect(mockStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({
          rendering: expect.objectContaining({ imageResamplingMethod: "nearest" }),
        }),
      );
    });
  });
});
