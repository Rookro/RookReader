import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { debug } from '@tauri-apps/plugin-log';
import { HistoryEntry } from "../types/HistoryEntry";

export const historySlice = createSlice({
    name: "history",
    initialState: {
        isHistoryEnabled: true,
        entries: [] as HistoryEntry[],
    },
    reducers: {
        setIsHistoryEnabled: (state, action: PayloadAction<boolean>) => {
            debug(`setIsHistoryEnabled(${action.payload}).`);
            state.isHistoryEnabled = action.payload;
        },
        setHistoryEntries: (state, action: PayloadAction<HistoryEntry[]>) => {
            debug(`setHistoryEntries.`);
            state.entries = action.payload;
        },
    },
});

export const {
    setIsHistoryEnabled,
    setHistoryEntries,
} = historySlice.actions;
export default historySlice.reducer;
