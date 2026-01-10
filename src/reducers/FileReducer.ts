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
            const entriesResult = await getEntriesInContainer(path);
            debug(`openContainerFile: Retrieved ${entriesResult.entries.length} entries. (Container is directory: ${entriesResult.is_directory})`);
            return entriesResult;
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
            isDirectory: false,
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
            isLoading: false,
            error: null as string | null,
            isWatchEnabled: false,
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
        setIsWatchEnabled: (state, action: PayloadAction<boolean>) => {
            debug(`setIsWatchEnabled(${action.payload}).`);
            state.explorer.isWatchEnabled = action.payload;
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
                state.explorer.isLoading = true;
                state.explorer.error = null;
            })
            .addCase(getEntriesInDir.fulfilled, (state, action: PayloadAction<DirEntry[]>,) => {
                state.explorer.entries = action.payload;
                state.explorer.isLoading = false;
                state.explorer.error = null;
            })
            .addCase(getEntriesInDir.rejected, (state, action) => {
                state.explorer.entries = [];
                state.explorer.isLoading = false;
                state.explorer.error = action.payload as string;
            })
            .addCase(openContainerFile.pending, (state) => {
                state.containerFile.entries = [];
                state.containerFile.isLoading = true;
                state.containerFile.index = 0;
                state.containerFile.error = null;
            })
            .addCase(openContainerFile.fulfilled, (state, action: PayloadAction<{ entries: string[], is_directory: boolean }>) => {
                state.containerFile.entries = action.payload.entries;
                state.containerFile.isDirectory = action.payload.is_directory;
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
    setIsWatchEnabled,
    goBackContainerHistory,
    goForwardContainerHistory,
    goBackExplorerHistory,
    goForwardExplorerHistory,
} = fileSlice.actions;
export default fileSlice.reducer;
