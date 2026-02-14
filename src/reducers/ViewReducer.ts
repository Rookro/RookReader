import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Direction } from "../types/DirectionType";
import { settingsStore } from "../settings/SettingsStore";

export const viewSlice = createSlice({
  name: "view",
  initialState: {
    fontFamily:
      (await settingsStore.get<string>("font-family")) ??
      "Inter, Avenir, Helvetica, Arial, sans-serif",
    isTwoPagedView: true,
    direction: "rtl" as Direction,
    isFirstPageSingleView: true,
    enablePreview: true,
    novel: {
      font: "default-font",
      fontSize: 16,
    },
  },
  reducers: {
    setFontFamily: (state, action: PayloadAction<string>) => {
      state.fontFamily = action.payload;
    },
    setIsTwoPagedView: (state, action: PayloadAction<boolean>) => {
      state.isTwoPagedView = action.payload;
    },
    setDirection: (state, action: PayloadAction<Direction>) => {
      state.direction = action.payload;
    },
    setIsFirstPageSingleView: (state, action: PayloadAction<boolean>) => {
      state.isFirstPageSingleView = action.payload;
    },
    setNovelFont: (state, action: PayloadAction<string>) => {
      state.novel.font = action.payload;
    },
    setNovelFontSize: (state, action: PayloadAction<number>) => {
      state.novel.fontSize = action.payload;
    },
    setEnablePreview: (state, action: PayloadAction<boolean>) => {
      state.enablePreview = action.payload;
    },
  },
});

export const {
  setFontFamily,
  setIsTwoPagedView,
  setDirection,
  setIsFirstPageSingleView,
  setNovelFont,
  setNovelFontSize,
  setEnablePreview,
} = viewSlice.actions;
export default viewSlice.reducer;
