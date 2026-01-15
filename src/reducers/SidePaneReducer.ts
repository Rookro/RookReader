import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { debug } from "@tauri-apps/plugin-log";

export const sideTabSlice = createSlice({
  name: "side-tab",
  initialState: {
    left: {
      tabIndex: 0,
    },
  },
  reducers: {
    setLeftSideTabIndex: (state, action: PayloadAction<number>) => {
      debug(`setLeftSideTabIndex: ${action.payload}`);
      state.left.tabIndex = action.payload;
    },
  },
});

export const { setLeftSideTabIndex } = sideTabSlice.actions;
export default sideTabSlice.reducer;
