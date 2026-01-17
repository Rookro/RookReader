import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { debug } from "@tauri-apps/plugin-log";

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
      debug(`setIsLeftSidePanelsHidden: ${action.payload}`);
      state.left.isHidden = action.payload;
    },
    setLeftSideTabIndex: (state, action: PayloadAction<number>) => {
      debug(`setLeftSideTabIndex: ${action.payload}`);
      state.left.tabIndex = action.payload;
    },
  },
});

export const { setIsLeftSidePanelsHidden, setLeftSideTabIndex } = sidePaneSlice.actions;
export default sidePaneSlice.reducer;
