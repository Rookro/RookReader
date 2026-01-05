import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { debug } from '@tauri-apps/plugin-log';
import { HistoryEntry } from "../types/HistoryEntry";

export const historySlice = createSlice({
    name: "history",
    initialState: {
        entries: [] as HistoryEntry[],
    },
    reducers: {
        setHistoryEntries: (state, action: PayloadAction<HistoryEntry[]>) => {
            debug(`setHistoryEntries.`);
            state.entries = action.payload;
        },
    },
});

export const {
    setHistoryEntries,
} = historySlice.actions;
export default historySlice.reducer;
