import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsApp from "./SettingsApp";
import { createBasePreloadedState, renderWithProviders } from "./test/utils";
import { ErrorCode } from "./types/Error";

const useSettingsChange = vi.fn();
vi.mock("./features/Settings/hooks/useSettingsChange", () => ({
  useSettingsChange: () => useSettingsChange(),
}));

// SettingsView pulls in the whole settings form; stub it so this test stays
// focused on the cross-window sync wiring.
vi.mock("./features/Settings/components/SettingsView", () => ({
  default: () => <div data-testid="settings-view" />,
}));

describe("SettingsApp", () => {
  it("mounts the settings-change listener so the window stays in sync with other windows", () => {
    renderWithProviders(<SettingsApp />);

    expect(useSettingsChange).toHaveBeenCalled();
  });

  it("shows a settings save error raised in the settings window", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.errorNotification.pending = [
      { context: "settings-save", code: ErrorCode.settings },
    ];

    const { store } = renderWithProviders(<SettingsApp />, { preloadedState });

    expect(
      await screen.findByText("Failed to save settings. (Error code: 50001)"),
    ).toBeInTheDocument();
    await waitFor(() => expect(store.getState().errorNotification.pending).toEqual([]));
  });
});
