import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Direction } from "../types/DirectionType";

export const viewSlice = createSlice({
  name: "view",
  initialState: {
    isTwoPagedView: true,
    direction: "rtl" as Direction,
    isFirstPageSingleView: true,
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
  },
});

export const { setIsTwoPagedView, setDirection, setIsFirstPageSingleView } = viewSlice.actions;
export default viewSlice.reducer;
