import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../test/mocks/tauri";
import defaultSettingsFixture from "./defaultSettings.json";
import { defaultSettings, loadAllSettings } from "./settingsStore";

describe("SettingsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaultSettings matches the backend defaults fixture", () => {
    // defaultSettings.json is generated from the backend defaults (home directory
    // neutralized to ""); a Rust test keeps that fixture in sync with the backend, so
    // this ties the TS defaultSettings object to the backend too.
    expect(defaultSettings).toEqual(defaultSettingsFixture);
  });

  describe("loadAllSettings", () => {
    it("should return the settings provided by the backend get_settings command", async () => {
      const backendSettings = structuredClone(defaultSettings);
      backendSettings.general.theme = "dark";
      backendSettings.bookshelf.gridSize = 2;
      mockTauri.invoke.mockResolvedValue(backendSettings);

      const settings = await loadAllSettings();

      expect(mockTauri.invoke).toHaveBeenCalledWith("get_settings");
      expect(settings.general.theme).toBe("dark");
      expect(settings.bookshelf.gridSize).toBe(2);
    });

    it("should fall back to defaultSettings when the backend load fails", async () => {
      mockTauri.invoke.mockRejectedValue({ code: 50001, message: "boom" });

      const settings = await loadAllSettings();

      expect(settings).toEqual(defaultSettings);
    });
  });
});
