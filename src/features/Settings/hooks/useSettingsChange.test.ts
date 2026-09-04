import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import i18n from "../../../i18n/config";
import { useAppDispatch } from "../../../store/store";
import { perfStart } from "../../../utils/perf";
import { defaultSettings } from "../settingsStore";
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

describe("useSettingsChange", () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
  });

  it("should register listeners for 'settings-changed' and 'locale-changed'", () => {
    renderHook(() => useSettingsChange());
    expect(useTauriEvent).toHaveBeenCalledWith("settings-changed", expect.any(Function));
    expect(useTauriEvent).toHaveBeenCalledWith("locale-changed", expect.any(Function));
  });

  it("should dispatch setSettings with the settings-changed payload", () => {
    const payload = structuredClone(defaultSettings);
    payload.general.theme = "dark";

    renderHook(() => useSettingsChange());
    const settingsHandler = vi
      .mocked(useTauriEvent)
      .mock.calls.find(([name]) => name === "settings-changed")?.[1];
    settingsHandler?.({ event: "settings-changed", id: 1, payload });

    expect(setSettings).toHaveBeenCalledWith(payload);
    expect(mockDispatch).toHaveBeenCalledWith({ type: "setSettings", payload });
  });

  it("should turn the perf log on and off with the broadcast level", () => {
    // Asserted through what the flag actually does, because that is the point: the reader
    // window writes the `display` and `chain` records, and this event is the only thing
    // that reaches it when the change was made in the settings window.
    expect(perfStart()).toBeNull();

    renderHook(() => useSettingsChange());
    const settingsHandler = vi
      .mocked(useTauriEvent)
      .mock.calls.find(([name]) => name === "settings-changed")?.[1];

    const debugLevel = structuredClone(defaultSettings);
    debugLevel.general.log.level = "debug";
    settingsHandler?.({ event: "settings-changed", id: 1, payload: debugLevel });
    expect(perfStart()).toEqual(expect.any(Number));

    const infoLevel = structuredClone(defaultSettings);
    infoLevel.general.log.level = "info";
    settingsHandler?.({ event: "settings-changed", id: 2, payload: infoLevel });
    expect(perfStart()).toBeNull();
  });

  it("should change i18n language on a locale-changed event", () => {
    renderHook(() => useSettingsChange());
    const localeHandler = vi
      .mocked(useTauriEvent)
      .mock.calls.find(([name]) => name === "locale-changed")?.[1];
    localeHandler?.({ event: "locale-changed", id: 1, payload: { language: "ja" } });

    expect(i18n.changeLanguage).toHaveBeenCalledWith("ja");
  });
});
