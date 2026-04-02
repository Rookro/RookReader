import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import InitialViewSetting from "./InitialViewSetting";
import { mockStore } from "../../../../../test/mocks/tauri";

describe("InitialViewSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial view from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.startup.initialView = "bookshelf";

    renderWithProviders(<InitialViewSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent(/Bookshelf/i);
    });
  });

  it("should update store when selection changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.startup.initialView = "reader";

    renderWithProviders(<InitialViewSetting />, { preloadedState });

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await user.click(select);

    const listbox = await screen.findByRole("listbox");
    const option = within(listbox).getByText(/Bookshelf/i);
    await user.click(option);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "startup",
        expect.objectContaining({ initialView: "bookshelf" }),
      );
    });
  });
});
