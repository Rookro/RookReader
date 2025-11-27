import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Direction } from "../types/DirectionType";

export const viewSlice = createSlice({
    name: "view",
    initialState: {
        isTwoPagedView: true,
        direction: "rtl" as Direction,
    },
    reducers: {
        setIsTwoPagedView: (state, action: PayloadAction<boolean>) => {
            state.isTwoPagedView = action.payload;
        },
        setDirection: (state, action: PayloadAction<Direction>) => {
            state.direction = action.payload;
        }
    }
});

export const { setIsTwoPagedView, setDirection } = viewSlice.actions;
export default viewSlice.reducer;
