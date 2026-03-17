import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSettingsChange } from "./useSettingsChange";
import { useAppDispatch } from "../Store";
import { useTauriEvent } from "./useTauriEvent";
import i18n from "../i18n/config";
import { setIsWatchEnabled } from "../reducers/ReadReducer";
import {
  setEnableHistory,
  setEnablePreview,
  setFontFamily,
  setIsFirstPageSingleView,
  setNovelFont,
  setNovelFontSize,
} from "../reducers/ViewReducer";

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

vi.mock("../reducers/ReadReducer", () => ({
  setIsWatchEnabled: vi.fn((v) => ({ type: "setIsWatchEnabled", payload: v })),
}));

vi.mock("../reducers/ViewReducer", () => ({
  setEnableHistory: vi.fn((v) => ({ type: "setEnableHistory", payload: v })),
  setEnablePreview: vi.fn((v) => ({ type: "setEnablePreview", payload: v })),
  setFontFamily: vi.fn((v) => ({ type: "setFontFamily", payload: v })),
  setIsFirstPageSingleView: vi.fn((v) => ({ type: "setIsFirstPageSingleView", payload: v })),
  setNovelFont: vi.fn((v) => ({ type: "setNovelFont", payload: v })),
  setNovelFontSize: vi.fn((v) => ({ type: "setNovelFontSize", payload: v })),
}));

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

  // Verify that setFontFamily action is dispatched when fontFamily changes
  it("should dispatch setFontFamily when fontFamily changes", () => {
    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];

    handler({ event: "settings-changed", id: 1, payload: { fontFamily: "Arial" } });
    expect(setFontFamily).toHaveBeenCalledWith("Arial");
    expect(mockDispatch).toHaveBeenCalledWith({ type: "setFontFamily", payload: "Arial" });
  });

  // Verify that i18n language is switched when locale settings change
  it("should change i18n language when locale changes", () => {
    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];

    handler({ event: "settings-changed", id: 1, payload: { locale: { language: "ja" } } });
    expect(i18n.changeLanguage).toHaveBeenCalledWith("ja");
  });

  // Verify that changes in view settings (e.g., first page single view, enable preview) are correctly dispatched
  it("should dispatch view settings changes", () => {
    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];

    handler({
      event: "settings-changed",
      id: 1,
      payload: {
        view: {
          isFirstPageSingleView: true,
          enablePreview: false,
        },
      },
    });

    expect(setIsFirstPageSingleView).toHaveBeenCalledWith(true);
    expect(setEnablePreview).toHaveBeenCalledWith(false);
  });

  // Verify that changes in history settings are correctly dispatched
  it("should dispatch history settings changes", () => {
    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];

    handler({
      event: "settings-changed",
      id: 1,
      payload: {
        history: {
          isEnabled: true,
        },
      },
    });

    expect(setEnableHistory).toHaveBeenCalledWith(true);
  });

  // Verify that changes in file navigator settings (e.g., directory watch) are correctly dispatched
  it("should dispatch file navigator settings changes", () => {
    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];

    handler({
      event: "settings-changed",
      id: 1,
      payload: {
        fileNavigator: {
          isDirWatchEnabled: true,
        },
      },
    });

    expect(setIsWatchEnabled).toHaveBeenCalledWith(true);
  });

  // Verify that changes in novel reader settings (e.g., font, font size) are correctly dispatched
  it("should dispatch novel reader settings changes", () => {
    renderHook(() => useSettingsChange());
    const handler = vi.mocked(useTauriEvent).mock.calls[0][1];

    handler({
      event: "settings-changed",
      id: 1,
      payload: {
        novelReader: {
          font: "Serif",
          "font-size": 18,
        },
      },
    });

    expect(setNovelFont).toHaveBeenCalledWith("Serif");
    expect(setNovelFontSize).toHaveBeenCalledWith(18);
  });
});
