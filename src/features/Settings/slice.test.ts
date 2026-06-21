import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDispatch } from "../../store/store";
import { mockTauri } from "../../test/mocks/tauri";
import { mockSettingsCommands } from "../../test/utils";
import { ErrorCode } from "../../types/Error";
import settingsErrorReducer from "./errorSlice";
import { defaultSettings } from "./settingsStore";
import settingsReducer, { setSettings, updateSettings } from "./slice";

describe("SettingsReducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("should return the initial state", () => {
    expect(settingsReducer(undefined, { type: "" })).toEqual(defaultSettings);
  });

  it("should handle setSettings", () => {
    const newSettings = {
      ...defaultSettings,
      general: { ...defaultSettings.general, theme: "dark" as const },
    };
    const nextState = settingsReducer(defaultSettings, setSettings(newSettings));
    expect(nextState.general.theme).toBe("dark");
  });

  describe("updateSettings thunk", () => {
    it("should send only the changed leaf as a SettingsPatch and adopt the merged result", async () => {
      const store = configureStore({ reducer: { settings: settingsReducer } });

      await (store.dispatch as AppDispatch)(
        updateSettings({ key: "general", value: { theme: "dark" } }),
      );

      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { general: { theme: "dark" } },
      });
      // The slice is replaced by the full settings the backend returned.
      expect(store.getState().settings.general.theme).toBe("dark");
    });

    it("should send a deep leaf patch without rebuilding the category", async () => {
      const store = configureStore({ reducer: { settings: settingsReducer } });

      await (store.dispatch as AppDispatch)(
        updateSettings({ key: "reader", value: { rendering: { enableThumbnailPreview: false } } }),
      );

      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { rendering: { enableThumbnailPreview: false } } },
      });
      expect(store.getState().settings.reader.rendering.enableThumbnailPreview).toBe(false);
      // A sibling leaf of the same category is preserved (backend merge).
      expect(store.getState().settings.reader.comic.enableSpread).toBe(
        defaultSettings.reader.comic.enableSpread,
      );
    });

    it("should reject with SETTINGS_ERROR when the backend rejects the patch", async () => {
      mockTauri.invoke.mockRejectedValue({
        code: ErrorCode.SETTINGS_ERROR,
        message: "out of range",
      });
      const store = configureStore({ reducer: { settings: settingsReducer } });

      const result = await (store.dispatch as AppDispatch)(
        updateSettings({ key: "reader", value: { rendering: { maxImageHeight: 999999 } } }),
      );

      expect(result.meta.requestStatus).toBe("rejected");
      expect(result.payload).toEqual({ code: ErrorCode.SETTINGS_ERROR, message: "out of range" });
      // State is unchanged on rejection.
      expect(store.getState().settings.reader.rendering.maxImageHeight).toBe(
        defaultSettings.reader.rendering.maxImageHeight,
      );
    });

    it("records the error so the UI can surface it when the backend rejects", async () => {
      mockTauri.invoke.mockRejectedValue({
        code: ErrorCode.SETTINGS_ERROR,
        message: "Settings validation failed",
      });
      const store = configureStore({
        reducer: { settings: settingsReducer, settingsError: settingsErrorReducer },
      });

      await (store.dispatch as AppDispatch)(
        updateSettings({ key: "general", value: { theme: "dark" } }),
      );

      expect(store.getState().settingsError.error?.code).toBe(ErrorCode.SETTINGS_ERROR);
    });

    it("returns structured details and does NOT raise the centralized error for field violations", async () => {
      const details = [
        {
          path: "reader.rendering.maxImageHeight",
          kind: "outOfRange" as const,
          min: 0,
          max: 65535,
        },
      ];
      mockTauri.invoke.mockRejectedValue({
        code: ErrorCode.SETTINGS_VALIDATION_ERROR,
        message: "Settings validation failed",
        details,
      });
      const store = configureStore({
        reducer: { settings: settingsReducer, settingsError: settingsErrorReducer },
      });

      const result = await (store.dispatch as AppDispatch)(
        updateSettings({ key: "reader", value: { rendering: { maxImageHeight: 70000 } } }),
      );

      // The violation details ride along in the rejected payload for the component...
      expect(updateSettings.rejected.match(result)).toBe(true);
      if (updateSettings.rejected.match(result)) {
        expect(result.payload?.details).toEqual(details);
      }
      // ...and the centralized notification is suppressed (shown inline instead).
      expect(store.getState().settingsError.error).toBeNull();
    });
  });
});
