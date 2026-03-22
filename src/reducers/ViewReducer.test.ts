import { describe, it, expect } from "vitest";
import viewReducer, {
  setActiveView,
  setFontFamily,
  setIsTwoPagedView,
  setDirection,
  setIsFirstPageSingleView,
  setNovelFont,
  setNovelFontSize,
  setEnablePreview,
  setEnableHistory,
} from "./ViewReducer";

describe("ViewReducer", () => {
  const initialState = {
    fontFamily: "Inter, Avenir, Helvetica, Arial, sans-serif",
    activeView: "reader" as const,
    isTwoPagedView: true,
    direction: "rtl" as const,
    isFirstPageSingleView: true,
    enablePreview: true,
    enableHistory: true,
    novel: {
      font: "default-font",
      fontSize: 16,
    },
  };

  // Verify that switching between different views (reader, bookshelf, etc.) is handled correctly
  it("should handle setActiveView", () => {
    const nextState = viewReducer(initialState, setActiveView("bookshelf"));
    expect(nextState.activeView).toBe("bookshelf");
  });

  // Verify that app-wide font family settings are correctly updated
  it("should handle setFontFamily", () => {
    const nextState = viewReducer(initialState, setFontFamily("MS Gothic"));
    expect(nextState.fontFamily).toBe("MS Gothic");
  });

  // Verify that enabling/disabling of spread (two-paged) view is correctly updated
  it("should handle setIsTwoPagedView", () => {
    const nextState = viewReducer(initialState, setIsTwoPagedView(false));
    expect(nextState.isTwoPagedView).toBe(false);
  });

  // Verify that reading direction (LTR/RTL) settings are correctly updated
  it("should handle setDirection", () => {
    const nextState = viewReducer(initialState, setDirection("ltr"));
    expect(nextState.direction).toBe("ltr");
  });

  // Verify that the setting to display the first page as a single page is correctly updated
  it("should handle setIsFirstPageSingleView", () => {
    const nextState = viewReducer(initialState, setIsFirstPageSingleView(false));
    expect(nextState.isFirstPageSingleView).toBe(false);
  });

  // Verify that font settings for the novel reader are correctly updated
  it("should handle setNovelFont", () => {
    const nextState = viewReducer(initialState, setNovelFont("Serif"));
    expect(nextState.novel.font).toBe("Serif");
  });

  // Verify that font size settings for the novel reader are correctly updated
  it("should handle setNovelFontSize", () => {
    const nextState = viewReducer(initialState, setNovelFontSize(20));
    expect(nextState.novel.fontSize).toBe(20);
  });

  // Verify that enabling/disabling of preview display is correctly updated
  it("should handle setEnablePreview", () => {
    const nextState = viewReducer(initialState, setEnablePreview(false));
    expect(nextState.enablePreview).toBe(false);
  });

  // Verify that enabling/disabling of reading history saving is correctly updated
  it("should handle setEnableHistory", () => {
    const nextState = viewReducer(initialState, setEnableHistory(false));
    expect(nextState.enableHistory).toBe(false);
  });
});
