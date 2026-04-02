import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import i18n from "../../../i18n/config";
import { useAppDispatch } from "../../../store/store";
import { defaultSettings, loadAllSettings } from "../settingsStore";
import { setSettings } from "../slice";
import { useSettingsChange } from "./useSettingsChange";

vi.mock("../../../store/store", () => ({
  useAppDispatch: vi.fn(),
}));

vi.mock("../../../hooks/useTauriEvent", () => ({
  useTauriEvent: vi.fn(),
}));

vi.mock("../../../i18n/config", () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

vi.mock("../slice", async () => {
  const actual = await vi.importActual("../slice");
  return {
    ...actual,
    setSettings: vi.fn((v) => ({ type: "setSettings", payload: v })),
  };
});

vi.mock("../settingsStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../settingsStore")>();
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
