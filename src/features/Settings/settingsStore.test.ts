import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStore } from "../../test/mocks/tauri";
import { defaultSettings, loadAllSettings, settingsStore } from "./settingsStore";

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
        if (key === "general") {
          return Promise.resolve({
            ...defaultSettings.general,
            theme: "dark",
          });
        }
        if (key === "bookshelf") {
          return Promise.resolve({
            ...defaultSettings.bookshelf,
            gridSize: 2,
          });
        }
        return Promise.resolve(null);
      });

      const settings = await loadAllSettings();

      expect(settings.general.theme).toBe("dark");
      expect(settings.bookshelf.gridSize).toBe(2);
      // Other values should remain default
      expect(settings.reader).toEqual(defaultSettings.reader);
    });

    it("should not override when stored value type does not match default value type", async () => {
      mockStore.get.mockImplementation((key) => {
        // "bookshelf" is an object in defaultSettings
        if (key === "bookshelf") return Promise.resolve("not-an-object");
        // "history" is an object in defaultSettings
        if (key === "history") return Promise.resolve(123);
        return Promise.resolve(null);
      });

      const settings = await loadAllSettings();

      expect(settings.bookshelf).toEqual(defaultSettings.bookshelf);
      expect(settings.history).toEqual(defaultSettings.history);
    });

    it("should ignore null and undefined values from store", async () => {
      mockStore.get.mockImplementation((key) => {
        if (key === "general") return Promise.resolve(undefined);
        if (key === "startup") return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const settings = await loadAllSettings();

      expect(settings.general).toEqual(defaultSettings.general);
      expect(settings.startup).toEqual(defaultSettings.startup);
    });
  });

  describe("settingsStore instance", () => {
    it("should be initialized", () => {
      expect(settingsStore).toBeDefined();
    });
  });
});
