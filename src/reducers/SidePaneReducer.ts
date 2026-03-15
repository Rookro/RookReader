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
    /**
     * Sets the visibility state of the left side panels.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the boolean visibility state (true to hide, false to show).
     */
    setIsLeftSidePanelsHidden: (state, action: PayloadAction<boolean>) => {
      state.left.isHidden = action.payload;
    },
    /**
     * Sets the active tab index for the left side panel.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the index of the active tab.
     */
    setLeftSideTabIndex: (state, action: PayloadAction<number>) => {
      state.left.tabIndex = action.payload;
    },
  },
});

export const { setIsLeftSidePanelsHidden, setLeftSideTabIndex } = sidePaneSlice.actions;
export default sidePaneSlice.reducer;
