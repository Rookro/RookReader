import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { invoke } from "@tauri-apps/api/core";
import { debug, error } from '@tauri-apps/plugin-log';
import { DirEntry } from "../types/DirEntry";

/**
 * Zip ファイルのファイルエントリーを取得する
 */
export const getEntriesInZip = createAsyncThunk(
    "file/getEntriesInZip",
    async (zipPath: string) => {
        debug(`getEntriesInZip(${zipPath}).`);
        try {
            return await invoke<string[]>("get_entries_in_zip", { zipPath });
        } catch (e) {
            error(`Failed to getEntriesInZip(${zipPath}). Error: ${e}`);
            return [];
        }
    }
);

/**
 * ディレクトリーのファイルエントリーを取得する
 */
export const getEntriesInDir = createAsyncThunk(
    "file/getEntriesInDir",
    async (dirPath: string) => {
        debug(`getEntriesInDir(${dirPath}).`);
        try {
            const entries = await invoke<DirEntry[]>("get_entries_in_dir", { dirPath });
            return { basePath: dirPath, entries };
        } catch (e) {
            error(`Failed to getEntriesInDir(${dirPath}). Error: ${e}`);
            return { basePath: dirPath, entries: [] };
        }
    }
);

export const fileSlice = createSlice({
    name: "file",
    initialState: {
        containerPath: "",
        entries: [] as string[],
        index: 0,
        explore: {
            basePath: "",
            entries: [] as DirEntry[],
        }
    },
    reducers: {
        setContainerPath: (state, action: PayloadAction<string>) => {
            state.containerPath = action.payload;
        },
        setExploreBasePath: (state, action: PayloadAction<string>) => {
            state.explore.basePath = action.payload;
        },
        setImageIndex: (state, action: PayloadAction<number>) => {
            state.index = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(getEntriesInZip.fulfilled, (state, action: PayloadAction<string[]>,) => {
            state.entries = action.payload;
        });
        builder.addCase(getEntriesInDir.fulfilled, (state, action: PayloadAction<{ basePath: string, entries: DirEntry[] }>,) => {
            state.explore.basePath = action.payload.basePath;
            state.explore.entries = action.payload.entries;
        });
    }
});

export const { setContainerPath, setExploreBasePath, setImageIndex } = fileSlice.actions;
export default fileSlice.reducer;
