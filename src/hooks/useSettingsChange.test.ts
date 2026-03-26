import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSettingsChange } from "./useSettingsChange";
import { useAppDispatch } from "../Store";
import { useTauriEvent } from "./useTauriEvent";
import i18n from "../i18n/config";
import { setSettings } from "../reducers/SettingsReducer";
import { defaultSettings, loadAllSettings } from "../settings/SettingsStore";

vi.mock("../Store", () => ({
  useAppDispatch: vi.fn(),
}));

vi.mock("./useTauriEvent", () => ({
  useTauriEvent: vi.fn(),
}));

vi.mock("../i18n/config", () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

vi.mock("../reducers/SettingsReducer", () => ({
  setSettings: vi.fn((v) => ({ type: "setSettings", payload: v })),
}));

vi.mock("../settings/SettingsStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../settings/SettingsStore")>();
  return {
    ...actual,
    loadAllSettings: vi.fn(),
  };
});

describe("useSettingsChange", () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
  });

  // Verify that the Tauri event listener for 'settings-changed' is setup
  it("should setup a Tauri event listener for 'settings-changed'", () => {
    renderHook(() => useSettingsChange());
    expect(useTauriEvent).toHaveBeenCalledWith("settings-changed", expect.any(Function));
  });

  // Verify that i18n language is switched when locale settings change
  it("should change i18n language when locale changes", async () => {
    const mockSettings = { ...defaultSettings };
    vi.mocked(loadAllSettings).mockResolvedValue(mockSettings);

    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];
    handler({ event: "settings-changed", id: 1, payload: { locale: { language: "ja" } } });

    expect(i18n.changeLanguage).toHaveBeenCalledWith("ja");
  });

  // Verify that it loads all settings and dispatches setSettings
  it("should load all settings and dispatch setSettings", async () => {
    const mockSettings = { ...defaultSettings };
    vi.mocked(loadAllSettings).mockResolvedValue(mockSettings);

    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];
    handler({
      event: "settings-changed",
      id: 1,
      payload: { fontFamily: "Arial" },
    });

    await waitFor(() => {
      expect(loadAllSettings).toHaveBeenCalled();
      expect(setSettings).toHaveBeenCalledWith(mockSettings);
      expect(mockDispatch).toHaveBeenCalledWith({ type: "setSettings", payload: mockSettings });
    });
  });
});
