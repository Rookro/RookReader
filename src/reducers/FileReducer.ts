import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { dirname } from "@tauri-apps/api/path";
import { debug, error } from "@tauri-apps/plugin-log";
import { determineEpubNovel, getEntriesInContainer } from "../bindings/ContainerCommands";
import { getEntriesInDir as getEntriesInDirFromBackend } from "../bindings/DirectoryCommands";
import { AppDispatch, RootState } from "../Store";
import { DirEntry } from "../types/DirEntry";
import { SortOrder } from "../types/SortOrderType";
import { convertEntriesInDir } from "../utils/DirEntryUtils";
import { settingsStore } from "../settings/SettingsStore";
import { ExperimentalFeaturesSettings } from "../types/Settings";

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: string;
}>();

/**
 * Opens a container file.
 */
export const openContainerFile = createAppAsyncThunk(
  "file/openContainerFile",
  async (path: string, { dispatch, rejectWithValue }) => {
    debug(`openContainerFile(${path}).`);
    if (!path || path.length === 0) {
      const errorMessage = "Failed to openContainerFile. Error: Container path is empty.";
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
    try {
      const isEpubNovel =
        (await settingsStore.get<ExperimentalFeaturesSettings>("experimental-features"))?.[
          "enable-epub-novel-reader"
        ] && (await determineEpubNovel(path));

      let entriesResult;
      if (!isEpubNovel) {
        entriesResult = await getEntriesInContainer(path);
        debug(
          `openContainerFile: Retrieved ${entriesResult.entries.length} entries. (Container is directory: ${entriesResult.is_directory})`,
        );
      } else {
        debug(`openContainerFile: Epub Novel is opened.`);
      }

      const dirPath = await dirname(path);
      dispatch(updateExploreBasePath({ dirPath }));

      return {
        entries: entriesResult?.entries,
        is_directory: entriesResult?.is_directory ?? false,
        is_novel: isEpubNovel,
      };
    } catch (e) {
      const errorMessage = `Failed to openContainerFile(${path}). Error: ${e}`;
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

/**
 * Updates the explore base path and entries.
 */
export const updateExploreBasePath = createAppAsyncThunk(
  "file/updateExploreBasePath",
  async (
    args: { dirPath: string; forceUpdate?: boolean },
    { dispatch, getState, rejectWithValue },
  ) => {
    const { dirPath, forceUpdate } = args;
    debug(`updateExploreBasePath(${dirPath}).`);
    if (!dirPath || dirPath.length === 0) {
      const errorMessage = "Failed to updateExploreBasePath. Error: Directory path is empty.";
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }

    const state = getState();
    if (!forceUpdate && state.file.explorer.history[state.file.explorer.historyIndex] === dirPath) {
      return undefined;
    }

    dispatch(setIsDirEntriesLoading(true));
    dispatch(setExploreBasePath(dirPath));
    try {
      const buffer = await getEntriesInDirFromBackend(dirPath);
      const entries = convertEntriesInDir(buffer);
      return { path: dirPath, entries: entries };
    } catch (e) {
      const errorMessage = `Failed to getEntriesInDir(${dirPath}). Error: ${e}`;
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
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
      cfi: null as string | null,
      isNovel: false,
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
    },
  },
  reducers: {
    setContainerFilePath: (state, action: PayloadAction<string>) => {
      debug(`setContainerFilePath(${action.payload}).`);
      if (
        state.containerFile.history.length > 0 &&
        state.containerFile.history[state.containerFile.historyIndex] === action.payload
      ) {
        return;
      }

      debug(`setContainerFilePath: Update history.`);
      if (state.containerFile.historyIndex !== state.containerFile.history.length - 1) {
        state.containerFile.history = state.containerFile.history.slice(
          0,
          state.containerFile.historyIndex + 1,
        );
      }
      state.containerFile.history.push(action.payload);
      state.containerFile.historyIndex = state.containerFile.history.length - 1;
      state.containerFile.index = 0;
    },
    setImageIndex: (state, action: PayloadAction<number>) => {
      debug(`setImageIndex(${action.payload}).`);
      state.containerFile.index = action.payload;
      state.containerFile.cfi = null;
    },
    setExploreBasePath: (state, action: PayloadAction<string>) => {
      debug(`setExploreBasePath(${action.payload}).`);
      if (
        state.explorer.history.length > 0 &&
        state.explorer.history[state.explorer.historyIndex] === action.payload
      ) {
        return;
      }

      debug(`setExploreBasePath: Update history.`);
      if (state.explorer.historyIndex !== state.explorer.history.length - 1) {
        state.explorer.history = state.explorer.history.slice(0, state.explorer.historyIndex + 1);
      }
      state.explorer.history.push(action.payload);
      state.explorer.historyIndex = state.explorer.history.length - 1;

      state.explorer.searchText = "";
      state.explorer.isLoading = true;
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
    setIsDirEntriesLoading: (state, action: PayloadAction<boolean>) => {
      debug(`setIsDirEntriesLoading(${action.payload}).`);
      state.explorer.isLoading = action.payload;
    },
    setEntries: (state, action: PayloadAction<string[]>) => {
      debug(`setEntries(${action.payload}).`);
      state.containerFile.entries = action.payload;
    },
    setNovelLocation: (state, action: PayloadAction<{ index: number; cfi: string }>) => {
      debug(`setNovelLocation(${JSON.stringify(action.payload)}).`);
      state.containerFile.index = action.payload.index;
      state.containerFile.cfi = action.payload.cfi;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateExploreBasePath.pending, (state) => {
        state.explorer.error = null;
      })
      .addCase(
        updateExploreBasePath.fulfilled,
        (state, action: PayloadAction<{ path: string; entries: DirEntry[] } | undefined>) => {
          // Update the state only if the current path matches the payload,
          // as the user might have navigated away before the previous load finished (race condition).
          if (
            action.payload &&
            state.explorer.history[state.explorer.historyIndex] === action.payload.path
          ) {
            state.explorer.entries = action.payload.entries;
          }
          state.explorer.isLoading = false;
          state.explorer.error = null;
        },
      )
      .addCase(updateExploreBasePath.rejected, (state, action) => {
        state.explorer.entries = [];
        state.explorer.isLoading = false;
        state.explorer.error = action.payload as string;
      })
      .addCase(openContainerFile.pending, (state) => {
        state.containerFile.entries = [];
        state.containerFile.isLoading = true;
        state.containerFile.index = 0;
        state.containerFile.cfi = null;
        state.containerFile.error = null;
      })
      .addCase(
        openContainerFile.fulfilled,
        (
          state,
          action: PayloadAction<{ entries?: string[]; is_directory: boolean; is_novel?: boolean }>,
        ) => {
          if (action.payload.entries) {
            state.containerFile.entries = action.payload.entries;
          }
          state.containerFile.isDirectory = action.payload.is_directory;
          state.containerFile.isLoading = false;
          state.containerFile.index = 0;
          state.containerFile.cfi = null;
          state.containerFile.error = null;
          if (action.payload.is_novel !== undefined) {
            state.containerFile.isNovel = action.payload.is_novel;
          }
        },
      )
      .addCase(openContainerFile.rejected, (state, action) => {
        state.containerFile.entries = [];
        state.containerFile.isLoading = false;
        state.containerFile.index = 0;
        state.containerFile.cfi = null;
        state.containerFile.error = action.payload as string;
      });
  },
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
  setIsDirEntriesLoading,
  setEntries,
  setNovelLocation,
} = fileSlice.actions;
export default fileSlice.reducer;
