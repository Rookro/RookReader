import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Direction } from "../types/DirectionType";
import { settingsStore } from "../settings/SettingsStore";

export const viewSlice = createSlice({
  name: "view",
  initialState: {
    fontFamily:
      (await settingsStore.get<string>("font-family")) ??
      "Inter, Avenir, Helvetica, Arial, sans-serif",
    activeView: "reader" as "reader" | "bookshelf",
    isTwoPagedView: true,
    direction: "rtl" as Direction,
    isFirstPageSingleView: true,
    enablePreview: true,
    enableHistory: true,
    novel: {
      font: "default-font",
      fontSize: 16,
    },
  },
  reducers: {
    /**
     * Sets the currently active primary view in the application.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the active view identifier ("reader" or "bookshelf").
     */
    setActiveView: (state, action: PayloadAction<"reader" | "bookshelf">) => {
      state.activeView = action.payload;
    },
    /**
     * Sets the global font family for the application UI.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the font family string.
     */
    setFontFamily: (state, action: PayloadAction<string>) => {
      state.fontFamily = action.payload;
    },
    /**
     * Sets whether the reader should display two pages side-by-side.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the boolean state.
     */
    setIsTwoPagedView: (state, action: PayloadAction<boolean>) => {
      state.isTwoPagedView = action.payload;
    },
    /**
     * Sets the reading direction for the viewer (e.g., right-to-left or left-to-right).
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the new Direction.
     */
    setDirection: (state, action: PayloadAction<Direction>) => {
      state.direction = action.payload;
    },
    /**
     * Sets whether the first page of a book should be displayed as a single page in two-page view.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the boolean state.
     */
    setIsFirstPageSingleView: (state, action: PayloadAction<boolean>) => {
      state.isFirstPageSingleView = action.payload;
    },
    /**
     * Sets the font family to be used specifically within the novel reader.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the novel font identifier.
     */
    setNovelFont: (state, action: PayloadAction<string>) => {
      state.novel.font = action.payload;
    },
    /**
     * Sets the font size for the novel reader.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the font size in pixels.
     */
    setNovelFontSize: (state, action: PayloadAction<number>) => {
      state.novel.fontSize = action.payload;
    },
    /**
     * Enables or disables the preview feature (e.g., page thumbnails).
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the boolean state.
     */
    setEnablePreview: (state, action: PayloadAction<boolean>) => {
      state.enablePreview = action.payload;
    },
    /**
     * Enables or disables reading history tracking.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the boolean state.
     */
    setEnableHistory: (state, action: PayloadAction<boolean>) => {
      state.enableHistory = action.payload;
    },
  },
});

export const {
  setActiveView,
  setFontFamily,
  setIsTwoPagedView,
  setDirection,
  setIsFirstPageSingleView,
  setNovelFont,
  setNovelFontSize,
  setEnablePreview,
  setEnableHistory,
} = viewSlice.actions;
export default viewSlice.reducer;
