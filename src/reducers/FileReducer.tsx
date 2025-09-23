import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { invoke } from "@tauri-apps/api/core";
import { debug, error } from '@tauri-apps/plugin-log';
import { DirEntry } from "../types/DirEntry";

type ContainerFileState = {
    path: string;
    entries: string[];
    index: number;
}

export const setContainerFile = createAsyncThunk(
    "file/setContainerFile",
    async (path: string): Promise<ContainerFileState> => {
        debug(`setContainerFile(${path}).`);
        try {
            const entries = await invoke<string[]>("get_entries_in_container", { path });
            return { path, entries, index: 0 };
        } catch (e) {
            error(`Failed to setContainerFile(${path}). Error: ${e}`);
            return { path: path, entries: [], index: 0 };
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
        containerFile: {
            path: "",
            entries: [],
            index: 0,
        } as ContainerFileState,
        explore: {
            basePath: "",
            entries: [] as DirEntry[],
            searchText: "",
        }
    },
    reducers: {
        setExploreBasePath: (state, action: PayloadAction<string>) => {
            state.explore.basePath = action.payload;
        },
        setImageIndex: (state, action: PayloadAction<number>) => {
            state.containerFile.index = action.payload;
        },
        setSearchText: (state, action: PayloadAction<string>) => {
            state.explore.searchText = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(getEntriesInDir.fulfilled, (state, action: PayloadAction<{ basePath: string, entries: DirEntry[] }>,) => {
            state.explore.basePath = action.payload.basePath;
            state.explore.entries = action.payload.entries;
        });
        builder.addCase(setContainerFile.fulfilled, (state, action: PayloadAction<ContainerFileState>,) => {
            state.containerFile = action.payload;
        });
    }
});

export const { setExploreBasePath, setImageIndex, setSearchText } = fileSlice.actions;
export default fileSlice.reducer;
