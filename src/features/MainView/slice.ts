import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const viewSlice = createSlice({
  name: "view",
  initialState: {
    activeView: "reader" as "reader" | "bookshelf",
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
  },
});

export const { setActiveView } = viewSlice.actions;
export default viewSlice.reducer;
