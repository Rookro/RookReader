import { describe, it, expect, vi, beforeEach } from "vitest";
import settingsReducer, { updateSettings, setSettings } from "./SettingsReducer";
import { defaultSettings, settingsStore } from "../settings/SettingsStore";
import { configureStore } from "@reduxjs/toolkit";
import { ErrorCode } from "../types/Error";
import { AppDispatch } from "../Store";

vi.mock("../settings/SettingsStore", () => ({
  defaultSettings: {
    "font-family": "Inter",
    theme: "light",
    rendering: { "enable-preview": true },
  },
  settingsStore: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(),
  },
}));

describe("SettingsReducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the initial state", () => {
    expect(settingsReducer(undefined, { type: "" })).toEqual(defaultSettings);
  });

  it("should handle setSettings", () => {
    const newSettings = { ...defaultSettings, theme: "dark" as const };
    const nextState = settingsReducer(defaultSettings, setSettings(newSettings));
    expect(nextState.theme).toBe("dark");
  });

  describe("updateSettings thunk", () => {
    it("should update a simple setting", async () => {
      const store = configureStore({
        reducer: { settings: settingsReducer },
      });

      await (store.dispatch as AppDispatch)(updateSettings({ key: "theme", value: "dark" }));

      expect(settingsStore.set).toHaveBeenCalledWith("theme", "dark");
      expect(store.getState().settings.theme).toBe("dark");
    });

    it("should update a nested object setting partially", async () => {
      const store = configureStore({
        reducer: { settings: settingsReducer },
      });

      await (store.dispatch as AppDispatch)(
        updateSettings({ key: "rendering", value: { "enable-preview": false } }),
      );

      expect(settingsStore.set).toHaveBeenCalledWith(
        "rendering",
        expect.objectContaining({ "enable-preview": false }),
      );
      expect(store.getState().settings.rendering["enable-preview"]).toBe(false);
    });

    it("should reject if key is undefined", async () => {
      const store = configureStore({
        reducer: { settings: settingsReducer },
      });

      const result = await (store.dispatch as AppDispatch)(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- for testing invalid input
        updateSettings({ key: undefined as any, value: "test" }),
      );

      expect(result.meta.requestStatus).toBe("rejected");
      expect(result.payload).toEqual({
        code: ErrorCode.SETTINGS_ERROR,
        message: "Failed to updateSettings. Error: Key is undefined.",
      });
    });
  });
});
