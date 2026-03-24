import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import HomeDirSetting from "./HomeDirSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import * as dialog from "@tauri-apps/plugin-dialog";

describe("HomeDirSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial home directory from store", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByDisplayValue("/saved/path")).toBeInTheDocument();
    });
  });

  it("should update store when text input changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const input = await screen.findByDisplayValue("/saved/path");
    await user.clear(input);
    await user.type(input, "/manual/path");
    await user.tab(); // Blur trigger

    expect(mockStore.set).toHaveBeenCalledWith(
      "fileNavigator",
      expect.objectContaining({ homeDirectory: "/manual/path" }),
    );
  });

  it("should open dialog and update store when folder button is clicked", async () => {
    vi.mocked(dialog.open).mockResolvedValue("/picked/path");
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/saved/path";

    renderWithProviders(<HomeDirSetting />, { preloadedState });

    const folderButton = screen.getByRole("button");
    await user.click(folderButton);

    expect(dialog.open).toHaveBeenCalledWith({ multiple: false, directory: true });

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "fileNavigator",
        expect.objectContaining({ homeDirectory: "/picked/path" }),
      );
      expect(screen.getByDisplayValue("/picked/path")).toBeInTheDocument();
    });
  });
});
