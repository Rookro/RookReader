import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import PreviewSetting from "./PreviewSetting";
import { mockStore } from "../../../../test/mocks/tauri";
import { emit } from "@tauri-apps/api/event";

describe("PreviewSetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load initial state from settingsStore", async () => {
    mockStore.get.mockResolvedValue({ "enable-preview": true });

    renderWithProviders(<PreviewSetting />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeChecked();
    });
  });

  it("should update store and emit event when toggled", async () => {
    mockStore.get.mockResolvedValue({ "enable-preview": true });

    renderWithProviders(<PreviewSetting />);

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    const switchElement = screen.getByRole("switch");
    await user.click(switchElement);

    await waitFor(() => {
      expect(mockStore.set).toHaveBeenCalledWith(
        "rendering",
        expect.objectContaining({ "enable-preview": false }),
      );
      expect(emit).toHaveBeenCalledWith("settings-changed", {
        view: { enablePreview: false },
      });
    });
  });
});
