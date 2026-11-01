import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { getEntriesInDir as getEntriesInDirFromBackend } from "../../bindings/DirectoryCommands";
import { handleThunkError } from "../../store/thunkErrorHandler";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { DirEntry } from "../../types/DirEntry";
import { ErrorCode } from "../../types/Error";
import { convertEntriesInDir } from "../../utils/DirEntryUtils";
import { goBackHistory, goForwardHistory, pushHistory } from "./utils/navigationHistory";

/**
 * Updates the base path for the file explorer and fetches its contents.
 *
 * @param args - The arguments for updating the explore base path.
 * @param args.dirPath - The absolute directory path to explore.
 * @param args.forceUpdate - If true, forces a fetch even if the path is already the current one.
 * @returns A thunk that resolves to the directory path and its entries. When the folder is
 * already shown and `forceUpdate` is not set, nothing is dispatched.
 */
export const updateExploreBasePath = createAppAsyncThunk(
  "fileNavigator/updateExploreBasePath",
  async (args: { dirPath: string; forceUpdate?: boolean }, { dispatch, rejectWithValue }) => {
    const { dirPath } = args;
    if (!dirPath || dirPath.length === 0) {
      const errorMessage = "Failed to updateExploreBasePath. Error: Directory path is empty.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.path, message: errorMessage });
    }

    dispatch(setIsDirEntriesLoading(true));
    dispatch(setExploreBasePath(dirPath));
    try {
      const buffer = await getEntriesInDirFromBackend(dirPath);
      const entries = convertEntriesInDir(buffer);
      return { path: dirPath, entries: entries };
    } catch (e) {
      return handleThunkError(e, `Failed to getEntriesInDir(${dirPath}).`, rejectWithValue);
    }
  },
  {
    // Already showing this folder: dispatch nothing, so no request supersedes one in flight.
    condition: ({ dirPath, forceUpdate }, { getState }) => {
      const { fileNavigator } = getState();
      return (
        Boolean(forceUpdate) ||
        !dirPath ||
        fileNavigator.history[fileNavigator.historyIndex] !== dirPath
      );
    },
  },
);

const initialState = {
  history: [] as string[],
  historyIndex: -1,
  entries: [] as DirEntry[],
  searchText: "",
  isLoading: false,
  error: null as { code: ErrorCode; message?: string } | null,
  /** The latest listing request; only its answer may change the explorer. */
  requestId: null as string | null,
  /** The folder that request lists, until it settles. */
  pendingPath: null as string | null,
};

/** The File Navigator's state: the folder history and the listing of the current folder. */
export type FileNavigatorState = typeof initialState;

export const fileNavigatorSlice = createSlice({
  name: "fileNavigator",
  initialState,
  reducers: {
    /**
     * Sets the base path for the file explorer and updates history.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the directory path.
     */
    setExploreBasePath: (state, action: PayloadAction<string>) => {
      if (!pushHistory(state, action.payload)) {
        return;
      }
      state.searchText = "";
      state.isLoading = true;
    },
    /**
     * Sets the search text within the file explorer.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the search text.
     */
    setSearchText: (state, action: PayloadAction<string>) => {
      state.searchText = action.payload;
    },
    /**
     * Navigates backwards in the file explorer history.
     *
     * @param state - The current Redux state slice.
     */
    goBackExplorerHistory: (state) => {
      goBackHistory(state);
    },
    /**
     * Navigates forwards in the file explorer history.
     *
     * @param state - The current Redux state slice.
     */
    goForwardExplorerHistory: (state) => {
      goForwardHistory(state);
    },
    /**
     * Sets the loading state for directory entries.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the loading state.
     */
    setIsDirEntriesLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    /**
     * Clears any error associated with the file explorer state.
     *
     * @param state - The current Redux state slice.
     */
    clearExplorerError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateExploreBasePath.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.pendingPath = action.meta.arg.dirPath;
        state.error = null;
      })
      .addCase(updateExploreBasePath.fulfilled, (state, action) => {
        // A listing superseded by a newer request, possibly of the same folder.
        if (action.meta.requestId !== state.requestId) {
          return;
        }
        state.pendingPath = null;
        // Update the entries only if the current path matches the payload,
        // as the user might have navigated away before the load finished.
        if (state.history[state.historyIndex] === action.payload.path) {
          state.entries = action.payload.entries;
        }
        state.isLoading = false;
        state.error = null;
      })
      .addCase(updateExploreBasePath.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestId) {
          return;
        }
        state.pendingPath = null;
        state.entries = [];
        state.isLoading = false;
        state.error = action.payload ?? null;
      });
  },
});

export const {
  setExploreBasePath,
  setSearchText,
  goBackExplorerHistory,
  goForwardExplorerHistory,
  setIsDirEntriesLoading,
  clearExplorerError,
} = fileNavigatorSlice.actions;
export default fileNavigatorSlice.reducer;
