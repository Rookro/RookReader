import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import HomeDirSetting from "./HomeDirSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import * as dialog from "@tauri-apps/plugin-dialog";

describe("HomeDirSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial home directory from store", async () => {
    mockStore.get.mockResolvedValue("/saved/path");

    renderWithProviders(<HomeDirSetting />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("/saved/path")).toBeInTheDocument();
    });
  });

  it("should update store when text input changes", async () => {
    mockStore.get.mockResolvedValue("/saved/path");

    renderWithProviders(<HomeDirSetting />);

    const input = await screen.findByDisplayValue("/saved/path");
    await user.clear(input);
    await user.type(input, "/manual/path");

    expect(mockStore.set).toHaveBeenCalledWith("home-directory", "/manual/path");
  });

  it("should open dialog and update store when folder button is clicked", async () => {
    mockStore.get.mockResolvedValue("/mock/home");
    vi.mocked(dialog.open).mockResolvedValue("/picked/path");

    renderWithProviders(<HomeDirSetting />);

    const folderButton = screen.getByRole("button");
    await user.click(folderButton);

    expect(dialog.open).toHaveBeenCalledWith({ multiple: false, directory: true });

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith("home-directory", "/picked/path");
      expect(screen.getByDisplayValue("/picked/path")).toBeInTheDocument();
    });
  });
});
