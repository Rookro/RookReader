import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadAllSettings, defaultSettings, settingsStore } from "./SettingsStore";
import { mockStore } from "../test/mocks/tauri";

describe("SettingsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadAllSettings", () => {
    it("should return defaultSettings when store returns null for all keys", async () => {
      // Mock get to return null for all keys
      mockStore.get.mockResolvedValue(null);

      const settings = await loadAllSettings();

      expect(settings).toEqual(defaultSettings);
      expect(mockStore.get).toHaveBeenCalledTimes(Object.keys(defaultSettings).length);
    });

    it("should override defaultSettings with values from store", async () => {
      // Mock specific values for some keys
      mockStore.get.mockImplementation((key) => {
        if (key === "theme") return Promise.resolve("dark");
        if (key === "bookshelf-grid-size") return Promise.resolve(2);
        if (key === "rendering") {
          return Promise.resolve({
            ...defaultSettings.rendering,
            "enable-preview": false,
          });
        }
        return Promise.resolve(null);
      });

      const settings = await loadAllSettings();

      expect(settings.theme).toBe("dark");
      expect(settings["bookshelf-grid-size"]).toBe(2);
      expect(settings.rendering["enable-preview"]).toBe(false);
      // Other values should remain default
      expect(settings["font-family"]).toBe(defaultSettings["font-family"]);
    });

    it("should not override when stored value type does not match default value type", async () => {
      mockStore.get.mockImplementation((key) => {
        // "bookshelf-grid-size" is a number in defaultSettings
        if (key === "bookshelf-grid-size") return Promise.resolve("not-a-number");
        // "two-paged" is a boolean in defaultSettings
        if (key === "two-paged") return Promise.resolve(123);
        return Promise.resolve(null);
      });

      const settings = await loadAllSettings();

      expect(settings["bookshelf-grid-size"]).toBe(defaultSettings["bookshelf-grid-size"]);
      expect(settings["two-paged"]).toBe(defaultSettings["two-paged"]);
    });

    it("should ignore null and undefined values from store", async () => {
      mockStore.get.mockImplementation((key) => {
        if (key === "theme") return Promise.resolve(undefined);
        if (key === "direction") return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const settings = await loadAllSettings();

      expect(settings.theme).toBe(defaultSettings.theme);
      expect(settings.direction).toBe(defaultSettings.direction);
    });
  });

  describe("settingsStore instance", () => {
    it("should be initialized", () => {
      expect(settingsStore).toBeDefined();
    });
  });
});
