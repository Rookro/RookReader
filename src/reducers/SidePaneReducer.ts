import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export const sidePaneSlice = createSlice({
  name: "side-pane",
  initialState: {
    left: {
      isHidden: false,
      tabIndex: 0,
    },
  },
  reducers: {
    setIsLeftSidePanelsHidden: (state, action: PayloadAction<boolean>) => {
      state.left.isHidden = action.payload;
    },
    setLeftSideTabIndex: (state, action: PayloadAction<number>) => {
      state.left.tabIndex = action.payload;
    },
  },
});

export const { setIsLeftSidePanelsHidden, setLeftSideTabIndex } = sidePaneSlice.actions;
export default sidePaneSlice.reducer;
