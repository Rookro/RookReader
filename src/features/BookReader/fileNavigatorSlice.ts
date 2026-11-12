import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { getEntriesInDir as getEntriesInDirFromBackend } from "../../bindings/binaryCommands";
import { createAppAsyncThunk } from "../../store/createCommandThunk";
import { handleThunkError } from "../../store/thunkErrorHandler";
import type { DirEntry } from "../../types/DirEntry";
import { ErrorCode } from "../../types/Error";
import { convertEntriesInDir } from "../../utils/DirEntryUtils";
import { goBackHistory, goForwardHistory, pushHistory } from "./utils/navigationHistory";

/**
 * Moves the File Navigator to a directory and lists its entries.
 *
 * @param args - The arguments for loading the directory.
 * @param args.dirPath - The absolute path of the directory to load.
 * @param args.forceUpdate - If true, forces a fetch even if the path is already the current one.
 * @returns A thunk that resolves to the directory path and its entries. When the folder is
 * already shown and `forceUpdate` is not set, nothing is dispatched.
 */
export const loadDirectory = createAppAsyncThunk(
  "fileNavigator/loadDirectory",
  async (
    args: { dirPath: string; forceUpdate?: boolean },
    { dispatch, getState, rejectWithValue, requestId },
  ) => {
    const { dirPath } = args;
    const isSuperseded = () => getState().fileNavigator.requestId !== requestId;
    if (!dirPath || dirPath.length === 0) {
      const errorMessage = "Failed to load the directory. Error: The path is empty.";
      error(errorMessage);
      return rejectWithValue({
        code: ErrorCode.path,
        message: errorMessage,
        ...(isSuperseded() && { superseded: true as const }),
      });
    }

    dispatch(setIsDirEntriesLoading(true));
    dispatch(directoryPathOpened(dirPath));
    try {
      const buffer = await getEntriesInDirFromBackend(dirPath);
      const entries = convertEntriesInDir(buffer);
      return { path: dirPath, entries: entries };
    } catch (e) {
      return handleThunkError(
        e,
        `Failed to load the directory(${dirPath}).`,
        rejectWithValue,
        isSuperseded(),
      );
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
  /** The latest listing request; only its answer may change the File Navigator. */
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
     * Moves the File Navigator to a directory and adds it to the history.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the directory path.
     */
    directoryPathOpened: (state, action: PayloadAction<string>) => {
      if (!pushHistory(state, action.payload)) {
        return;
      }
      state.searchText = "";
      state.isLoading = true;
    },
    /**
     * Sets the search text within the File Navigator.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the search text.
     */
    setSearchText: (state, action: PayloadAction<string>) => {
      state.searchText = action.payload;
    },
    /**
     * Navigates backwards in the File Navigator history.
     *
     * @param state - The current Redux state slice.
     */
    goBackNavigatorHistory: (state) => {
      goBackHistory(state);
    },
    /**
     * Navigates forwards in the File Navigator history.
     *
     * @param state - The current Redux state slice.
     */
    goForwardNavigatorHistory: (state) => {
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDirectory.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.pendingPath = action.meta.arg.dirPath;
      })
      .addCase(loadDirectory.fulfilled, (state, action) => {
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
      })
      .addCase(loadDirectory.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestId) {
          return;
        }
        state.pendingPath = null;
        state.entries = [];
        state.isLoading = false;
      });
  },
});

export const {
  directoryPathOpened,
  setSearchText,
  goBackNavigatorHistory,
  goForwardNavigatorHistory,
  setIsDirEntriesLoading,
} = fileNavigatorSlice.actions;
export default fileNavigatorSlice.reducer;
