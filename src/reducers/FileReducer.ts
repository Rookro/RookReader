import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { dirname } from "@tauri-apps/api/path";
import { debug, error, info } from "@tauri-apps/plugin-log";
import { determineEpubNovel, getEntriesInContainer } from "../bindings/ContainerCommands";
import { getEntriesInDir as getEntriesInDirFromBackend } from "../bindings/DirectoryCommands";
import { AppDispatch, RootState } from "../Store";
import { DirEntry } from "../types/DirEntry";
import { SortOrder } from "../types/SortOrderType";
import { convertEntriesInDir } from "../utils/DirEntryUtils";
import { settingsStore } from "../settings/SettingsStore";
import { ExperimentalFeaturesSettings } from "../types/Settings";
import { HistoryTable } from "../database/historyTable";
import { upsertHistory } from "./HistoryReducer";
import { CommandError, ErrorCode } from "../types/Error";

const historyTable = new HistoryTable();
await historyTable.init();

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: { code: ErrorCode; message?: string };
}>();

/**
 * Opens a container file.
 */
export const openContainerFile = createAppAsyncThunk(
  "file/openContainerFile",
  async (path: string, { dispatch, rejectWithValue }) => {
    if (!path || path.length === 0) {
      const errorMessage = "Failed to openContainerFile. Error: Container path is empty.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.PATH_ERROR, message: errorMessage });
    }
    info(`Open container file: ${path}`);
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

      debug(
        `Update container history: ${path}, ${entriesResult?.is_directory ? "DIRECTORY" : "FILE"}`,
      );
      dispatch(
        upsertHistory({ path: path, type: entriesResult?.is_directory ? "DIRECTORY" : "FILE" }),
      );

      let lastPageIndex = 0;
      try {
        lastPageIndex = await historyTable.selectPageIndex(path);
      } catch (e) {
        // This exception is expected when opening the path for the first time.
        debug(
          `Failed to select page index for ${path}. Error: ${e} (This is expected when opening the path for the first time.)`,
        );
      }

      return {
        entries: entriesResult?.entries,
        isDirectory: entriesResult?.is_directory ?? false,
        isNovel: isEpubNovel,
        latestPageIndex: lastPageIndex,
      };
    } catch (e) {
      const errorMessage = `Failed to openContainerFile(${path}). Error: ${JSON.stringify(e)}`;
      error(errorMessage);
      return rejectWithValue(
        e instanceof CommandError
          ? { code: e.code, message: errorMessage }
          : { code: ErrorCode.OTHER_ERROR, message: errorMessage },
      );
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
    if (!dirPath || dirPath.length === 0) {
      const errorMessage = "Failed to updateExploreBasePath. Error: Directory path is empty.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.PATH_ERROR, message: errorMessage });
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
      const errorMessage = `Failed to getEntriesInDir(${dirPath}). Error: ${JSON.stringify(e)}`;
      error(errorMessage);
      return rejectWithValue(
        e instanceof CommandError
          ? { code: e.code, message: errorMessage }
          : { code: ErrorCode.OTHER_ERROR, message: errorMessage },
      );
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
      error: null as { code: ErrorCode; message?: string } | null,
    },
    explorer: {
      history: [] as string[],
      historyIndex: -1,
      entries: [] as DirEntry[],
      searchText: "",
      sortOrder: "NAME_ASC" as SortOrder,
      isLoading: false,
      error: null as { code: ErrorCode; message?: string } | null,
      isWatchEnabled: false,
    },
  },
  reducers: {
    setContainerFilePath: (state, action: PayloadAction<string>) => {
      if (
        state.containerFile.history.length > 0 &&
        state.containerFile.history[state.containerFile.historyIndex] === action.payload
      ) {
        return;
      }

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
      state.containerFile.index = action.payload;
      state.containerFile.cfi = null;
    },
    setExploreBasePath: (state, action: PayloadAction<string>) => {
      if (
        state.explorer.history.length > 0 &&
        state.explorer.history[state.explorer.historyIndex] === action.payload
      ) {
        return;
      }

      if (state.explorer.historyIndex !== state.explorer.history.length - 1) {
        state.explorer.history = state.explorer.history.slice(0, state.explorer.historyIndex + 1);
      }
      state.explorer.history.push(action.payload);
      state.explorer.historyIndex = state.explorer.history.length - 1;

      state.explorer.searchText = "";
      state.explorer.isLoading = true;
    },
    setSearchText: (state, action: PayloadAction<string>) => {
      state.explorer.searchText = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<SortOrder>) => {
      state.explorer.sortOrder = action.payload;
    },
    setIsWatchEnabled: (state, action: PayloadAction<boolean>) => {
      state.explorer.isWatchEnabled = action.payload;
    },
    goBackContainerHistory: (state) => {
      if (state.containerFile.historyIndex > 0) {
        state.containerFile.historyIndex -= 1;
      }
    },
    goForwardContainerHistory: (state) => {
      if (state.containerFile.historyIndex < state.containerFile.history.length - 1) {
        state.containerFile.historyIndex += 1;
      }
    },
    goBackExplorerHistory: (state) => {
      if (state.explorer.historyIndex > 0) {
        state.explorer.historyIndex -= 1;
      }
    },
    goForwardExplorerHistory: (state) => {
      if (state.explorer.historyIndex < state.explorer.history.length - 1) {
        state.explorer.historyIndex += 1;
      }
    },
    setIsDirEntriesLoading: (state, action: PayloadAction<boolean>) => {
      state.explorer.isLoading = action.payload;
    },
    setEntries: (state, action: PayloadAction<string[]>) => {
      state.containerFile.entries = action.payload;
    },
    setNovelLocation: (state, action: PayloadAction<{ index: number; cfi: string }>) => {
      state.containerFile.index = action.payload.index;
      state.containerFile.cfi = action.payload.cfi;
    },
    clearContainerFileError: (state) => {
      state.containerFile.error = null;
    },
    clearExplorerError: (state) => {
      state.explorer.error = null;
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
        state.explorer.error = {
          code: action.payload?.code ?? ErrorCode.UNKNOWN_ERROR,
          message: action.payload?.message,
        };
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
          action: PayloadAction<{
            entries?: string[];
            isDirectory: boolean;
            isNovel?: boolean;
            latestPageIndex: number;
          }>,
        ) => {
          if (action.payload.entries) {
            state.containerFile.entries = action.payload.entries;
          }
          state.containerFile.isDirectory = action.payload.isDirectory;
          state.containerFile.isLoading = false;
          state.containerFile.index = action.payload.latestPageIndex;
          state.containerFile.cfi = null;
          state.containerFile.error = null;
          if (action.payload.isNovel !== undefined) {
            state.containerFile.isNovel = action.payload.isNovel;
          }
        },
      )
      .addCase(openContainerFile.rejected, (state, action) => {
        state.containerFile.entries = [];
        state.containerFile.isLoading = false;
        state.containerFile.index = 0;
        state.containerFile.cfi = null;
        state.containerFile.error = {
          code: action.payload?.code ?? ErrorCode.UNKNOWN_ERROR,
          message: action.payload?.message,
        };
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
  clearContainerFileError,
  clearExplorerError,
} = fileSlice.actions;
export default fileSlice.reducer;
