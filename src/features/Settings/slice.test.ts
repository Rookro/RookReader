import { describe, it, expect, vi, beforeEach } from "vitest";
import settingsReducer, { updateSettings, setSettings } from "./slice";
import { defaultSettings, settingsStore } from "./settingsStore";
import { configureStore } from "@reduxjs/toolkit";
import { ErrorCode } from "../../types/Error";
import { AppDispatch } from "../../store/store";

vi.mock("../settings/SettingsStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./settingsStore")>();
  return {
    ...actual,
    settingsStore: {
      set: vi.fn(() => Promise.resolve()),
      get: vi.fn(),
    },
  };
});

describe("SettingsReducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it("should update a simple setting", async () => {
      const store = configureStore({
        reducer: { settings: settingsReducer },
      });

      await (store.dispatch as AppDispatch)(
        updateSettings({ key: "general", value: { ...defaultSettings.general, theme: "dark" } }),
      );

      expect(settingsStore.set).toHaveBeenCalledWith("general", {
        ...defaultSettings.general,
        theme: "dark",
      });
      expect(store.getState().settings.general.theme).toBe("dark");
    });

    it("should update a nested object setting partially", async () => {
      const store = configureStore({
        reducer: { settings: settingsReducer },
      });

      await (store.dispatch as AppDispatch)(
        updateSettings({
          key: "reader",
          value: {
            ...defaultSettings.reader,
            rendering: { ...defaultSettings.reader.rendering, enableThumbnailPreview: false },
          },
        }),
      );

      expect(settingsStore.set).toHaveBeenCalledWith(
        "reader",
        expect.objectContaining({
          ...defaultSettings.reader,
          rendering: { ...defaultSettings.reader.rendering, enableThumbnailPreview: false },
        }),
      );
      expect(store.getState().settings.reader.rendering.enableThumbnailPreview).toBe(false);
    });

    it("should reject if key is undefined", async () => {
      const store = configureStore({
        reducer: { settings: settingsReducer },
      });

      const result = await (store.dispatch as AppDispatch)(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- for testing invalid input
        updateSettings({ key: undefined as any, value: "test" as any }),
      );

      expect(result.meta.requestStatus).toBe("rejected");
      expect(result.payload).toEqual({
        code: ErrorCode.SETTINGS_ERROR,
        message: "Failed to updateSettings. Error: Key is undefined.",
      });
    });
  });
});
