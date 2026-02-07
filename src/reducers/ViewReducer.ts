import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Direction } from "../types/DirectionType";

export const viewSlice = createSlice({
  name: "view",
  initialState: {
    isTwoPagedView: true,
    direction: "rtl" as Direction,
    isFirstPageSingleView: true,
    novel: {
      font: "default-font",
      fontSize: 16,
    },
  },
  reducers: {
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
  },
});

export const {
  setIsTwoPagedView,
  setDirection,
  setIsFirstPageSingleView,
  setNovelFont,
  setNovelFontSize,
} = viewSlice.actions;
export default viewSlice.reducer;
