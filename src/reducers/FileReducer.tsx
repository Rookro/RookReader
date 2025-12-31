import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { debug, error } from '@tauri-apps/plugin-log';
import { getEntriesInContainer } from "../bindings/ContainerCommands";
import { getEntriesInDir as getEntriesInDirFromBackend } from "../bindings/DirectoryCommands";
import { DirEntry } from "../types/DirEntry";
import { SortOrder } from "../types/SortOrderType";

/**
 * Opens a container file.
 */
export const openContainerFile = createAsyncThunk(
    "file/openContainerFile",
    async (path: string, { rejectWithValue }) => {
        debug(`openContainerFile(${path}).`);
        if (!path || path.length === 0) {
            const errorMessage = "Failed to getEntriesInDir. Error: Container path is empty.";
            error(errorMessage);
            return rejectWithValue(errorMessage);
        }
        try {
            const entries = await getEntriesInContainer(path);
            return entries;
        } catch (e) {
            const errorMessage = `Failed to openContainerFile(${path}). Error: ${e}`;
            error(errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

/**
 * Gets file entries in a directory.
 */
export const getEntriesInDir = createAsyncThunk(
    "file/getEntriesInDir",
    async (dirPath: string, { rejectWithValue }) => {
        debug(`getEntriesInDir(${dirPath}).`);
        if (!dirPath || dirPath.length === 0) {
            const errorMessage = "Failed to getEntriesInDir. Error: Directory path is empty.";
            error(errorMessage);
            return rejectWithValue(errorMessage);
        }
        try {
            const entries = await getEntriesInDirFromBackend(dirPath);
            return entries;
        } catch (e) {
            const errorMessage = `Failed to getEntriesInDir(${dirPath}). Error: ${e}`;
            error(errorMessage);
            return rejectWithValue(errorMessage);
        }
    }
);

export const fileSlice = createSlice({
    name: "file",
    initialState: {
        containerFile: {
            history: [] as string[],
            historyIndex: -1,
            entries: [] as string[],
            index: 0,
            isLoading: false,
            error: null as string | null,
        },
        explorer: {
            history: [] as string[],
            historyIndex: -1,
            entries: [] as DirEntry[],
            searchText: "",
            sortOrder: "NAME_ASC" as SortOrder,
            error: null as string | null,
        }
    },
    reducers: {
        setContainerFilePath: (state, action: PayloadAction<string>) => {
            debug(`setContainerFilePath(${action.payload}).`);
            if (state.containerFile.history.length > 0 && state.containerFile.history[state.containerFile.historyIndex] === action.payload) {
                return;
            }

            debug(`setContainerFilePath: Update history.`);
            if (state.containerFile.historyIndex !== state.containerFile.history.length - 1) {
                state.containerFile.history = state.containerFile.history.slice(0, state.containerFile.historyIndex + 1);
            }
            state.containerFile.history.push(action.payload);
            state.containerFile.historyIndex = state.containerFile.history.length - 1;
            state.containerFile.index = 0;
        },
        setImageIndex: (state, action: PayloadAction<number>) => {
            debug(`setImageIndex(${action.payload}).`);
            state.containerFile.index = action.payload;
        },
        setExploreBasePath: (state, action: PayloadAction<string>) => {
            debug(`setExploreBasePath(${action.payload}).`);
            if (state.explorer.history.length > 0 && state.explorer.history[state.explorer.historyIndex] === action.payload) {
                return;
            }

            debug(`setExploreBasePath: Update history.`);
            if (state.explorer.historyIndex !== state.explorer.history.length - 1) {
                state.explorer.history = state.explorer.history.slice(0, state.explorer.historyIndex + 1);
            }
            state.explorer.history.push(action.payload);
            state.explorer.historyIndex = state.explorer.history.length - 1;

            state.explorer.searchText = "";
        },
        setSearchText: (state, action: PayloadAction<string>) => {
            debug(`setSearchText(${action.payload}).`);
            state.explorer.searchText = action.payload;
        },
        setSortOrder: (state, action: PayloadAction<SortOrder>) => {
            debug(`setSortOrder(${action.payload}).`);
            state.explorer.sortOrder = action.payload;
        },
        goBackContainerHistory: (state) => {
            if (state.containerFile.historyIndex > 0) {
                debug("goBackContainerHistory");
                state.containerFile.historyIndex -= 1;
            }
        },
        goForwardContainerHistory: (state) => {
            if (state.containerFile.historyIndex < state.containerFile.history.length - 1) {
                debug("goForwardContainerHistory");
                state.containerFile.historyIndex += 1;
            }
        },
        goBackExplorerHistory: (state) => {
            if (state.explorer.historyIndex > 0) {
                debug("goBackExplorerHistory");
                state.explorer.historyIndex -= 1;
            }
        },
        goForwardExplorerHistory: (state) => {
            if (state.explorer.historyIndex < state.explorer.history.length - 1) {
                debug("goForwardExplorerHistory");
                state.explorer.historyIndex += 1;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getEntriesInDir.pending, (state) => {
                state.explorer.entries = [];
                state.explorer.error = null;
            })
            .addCase(getEntriesInDir.fulfilled, (state, action: PayloadAction<DirEntry[]>,) => {
                state.explorer.entries = action.payload;
                state.explorer.error = null;
            })
            .addCase(getEntriesInDir.rejected, (state, action) => {
                state.explorer.entries = [];
                state.explorer.error = action.payload as string;
            })
            .addCase(openContainerFile.pending, (state) => {
                state.containerFile.entries = [];
                state.containerFile.isLoading = true;
                state.containerFile.index = 0;
                state.containerFile.error = null;
            })
            .addCase(openContainerFile.fulfilled, (state, action: PayloadAction<string[]>,) => {
                state.containerFile.entries = action.payload;
                state.containerFile.isLoading = false;
                state.containerFile.index = 0;
                state.containerFile.error = null;
            })
            .addCase(openContainerFile.rejected, (state, action) => {
                state.containerFile.entries = [];
                state.containerFile.isLoading = false;
                state.containerFile.index = 0;
                state.containerFile.error = action.payload as string;
            });

    }
});

export const {
    setContainerFilePath,
    setImageIndex,
    setExploreBasePath,
    setSearchText,
    setSortOrder,
    goBackContainerHistory,
    goForwardContainerHistory,
    goBackExplorerHistory,
    goForwardExplorerHistory,
} = fileSlice.actions;
export default fileSlice.reducer;
