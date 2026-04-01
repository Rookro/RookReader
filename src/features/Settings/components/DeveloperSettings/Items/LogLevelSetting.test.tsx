import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../../test/utils";
import LogLevelSetting from "./LogLevelSetting";
import { mockStore } from "../../../../../test/mocks/tauri";
import { appLogDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";

describe("LogLevelSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial log directory and level from store", async () => {
    vi.mocked(appLogDir).mockResolvedValue("/mock/log/dir");
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.general.log.level = "debug";

    renderWithProviders(<LogLevelSetting />, { preloadedState });

    await waitFor(() => {
      expect(screen.getByDisplayValue("/mock/log/dir")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveTextContent(/Debug/i);
    });
  });

  it("should open log directory when folder button is clicked", async () => {
    vi.mocked(appLogDir).mockResolvedValue("/mock/log/dir");
    renderWithProviders(<LogLevelSetting />);

    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    const folderButton = screen.getByRole("button");
    await user.click(folderButton);

    await waitFor(() => {
      expect(openPath).toHaveBeenCalledWith("/mock/log/dir");
    });
  });

  it("should update store when log level is changed", async () => {
    mockStore.get.mockResolvedValue({ level: "Info" });

    renderWithProviders(<LogLevelSetting />);

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await user.click(select);

    const listbox = await screen.findByRole("listbox");
    const errorOption = within(listbox).getByText(/Error/i);
    await user.click(errorOption);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "general",
        expect.objectContaining({ log: { level: "error" } }),
      );
    });
  });
});
