import { describe, expect, it, vi } from "vitest";
import SettingsApp from "./SettingsApp";
import { renderWithProviders } from "./test/utils";

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
});
