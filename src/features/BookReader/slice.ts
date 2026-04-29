import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { basename, dirname } from "@tauri-apps/api/path";
import { debug, error, info } from "@tauri-apps/plugin-log";
import { getBookWithStateById, upsertReadBook } from "../../bindings/BookCommands";
import {
  determineEpubNovel,
  getEntriesInContainer,
  requestPreloadAround,
} from "../../bindings/ContainerCommands";
import { getEntriesInDir as getEntriesInDirFromBackend } from "../../bindings/DirectoryCommands";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import type { BookWithState } from "../../types/DatabaseModels";
import type { DirEntry } from "../../types/DirEntry";
import { CommandError, ErrorCode } from "../../types/Error";
import { convertEntriesInDir } from "../../utils/DirEntryUtils";

/**
 * Opens a container file or directory, retrieves its contents, and updates the reading history.
 *
 * @param path - The absolute file path to the container or directory.
 * @returns A thunk that resolves to an object containing entries, directory status, novel status, and book state.
 */
export const openContainerFile = createAppAsyncThunk(
  "read/openContainerFile",
  async (path: string, { dispatch, rejectWithValue }) => {
    if (!path || path.length === 0) {
      const errorMessage = "Failed to openContainerFile. Error: Container path is empty.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.PATH_ERROR, message: errorMessage });
    }
    info(`Open container file: ${path}`);
    try {
      const isEpubNovel = await determineEpubNovel(path);

      const bookByPath = await getBookWithStateById(
        await upsertReadBook({
          filePath: path,
          itemType: "file", // Temporary, will be updated below
          totalPages: 0,
          displayName: await basename(path),
        }),
      );
      const startIndex = bookByPath?.last_read_page_index ?? 0;

      let entriesResult: { entries: string[]; is_directory: boolean } | undefined;
      if (!isEpubNovel) {
        entriesResult = await getEntriesInContainer(path);
        requestPreloadAround(startIndex, entriesResult.entries.length).catch((e) => {
          error(`Failed to request preload: ${String(e)}`);
        });
        debug(
          `openContainerFile: Retrieved ${entriesResult.entries.length} entries. (Container is directory: ${entriesResult.is_directory})`,
        );
      } else {
        debug(`openContainerFile: Epub Novel is opened.`);
      }

      const dirPath = await dirname(path);
      dispatch(updateExploreBasePath({ dirPath }));

      debug(
        `Update container history: ${path}, ${entriesResult?.is_directory ? "directory" : "file"}`,
      );
      const bookId = await upsertReadBook({
        filePath: path,
        itemType: entriesResult?.is_directory ? "directory" : "file",
        totalPages: entriesResult?.entries.length ?? 0,
        displayName: await basename(path),
      });

      const book = await getBookWithStateById(bookId);

      return {
        entries: entriesResult?.entries,
        isDirectory: entriesResult?.is_directory ?? false,
        isNovel: isEpubNovel,
        book: book,
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
 * Updates the base path for the file explorer and fetches its contents.
 *
 * @param args - The arguments for updating the explore base path.
 * @param args.dirPath - The absolute directory path to explore.
 * @param args.forceUpdate - If true, forces a fetch even if the path is already the current one.
 * @returns A thunk that resolves to the directory path and its entries, or undefined if no update is needed.
 */
export const updateExploreBasePath = createAppAsyncThunk(
  "read/updateExploreBasePath",
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
    if (!forceUpdate && state.read.explorer.history[state.read.explorer.historyIndex] === dirPath) {
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

export const readSlice = createSlice({
  name: "read",
  initialState: {
    containerFile: {
      history: [] as string[],
      historyIndex: -1,
      isDirectory: false,
      entries: [] as string[],
      book: null as BookWithState | null,
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
      isLoading: false,
      error: null as { code: ErrorCode; message?: string } | null,
    },
  },
  reducers: {
    /**
     * Sets the path of the container file being read and updates history.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the container file path.
     */
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
      state.containerFile.isLoading = true;
    },
    /**
     * Sets the current image index within a container file.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the new image index.
     */
    setImageIndex: (state, action: PayloadAction<number>) => {
      state.containerFile.index = action.payload;
      state.containerFile.cfi = null;
    },
    /**
     * Sets the base path for the file explorer and updates history.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the directory path.
     */
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
    /**
     * Sets the search text within the file explorer.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the search text.
     */
    setSearchText: (state, action: PayloadAction<string>) => {
      state.explorer.searchText = action.payload;
    },
    /**
     * Navigates backwards in the container file history.
     *
     * @param state - The current Redux state slice.
     */
    goBackContainerHistory: (state) => {
      if (state.containerFile.historyIndex > 0) {
        state.containerFile.historyIndex -= 1;
        state.containerFile.isLoading = true;
      }
    },
    /**
     * Navigates forwards in the container file history.
     *
     * @param state - The current Redux state slice.
     */
    goForwardContainerHistory: (state) => {
      if (state.containerFile.historyIndex < state.containerFile.history.length - 1) {
        state.containerFile.historyIndex += 1;
        state.containerFile.isLoading = true;
      }
    },
    /**
     * Navigates backwards in the file explorer history.
     *
     * @param state - The current Redux state slice.
     */
    goBackExplorerHistory: (state) => {
      if (state.explorer.historyIndex > 0) {
        state.explorer.historyIndex -= 1;
      }
    },
    /**
     * Navigates forwards in the file explorer history.
     *
     * @param state - The current Redux state slice.
     */
    goForwardExplorerHistory: (state) => {
      if (state.explorer.historyIndex < state.explorer.history.length - 1) {
        state.explorer.historyIndex += 1;
      }
    },
    /**
     * Sets the loading state for directory entries.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the loading state.
     */
    setIsDirEntriesLoading: (state, action: PayloadAction<boolean>) => {
      state.explorer.isLoading = action.payload;
    },
    /**
     * Sets the list of entries within the current container file.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing an array of entry strings.
     */
    setEntries: (state, action: PayloadAction<string[]>) => {
      state.containerFile.entries = action.payload;
    },
    /**
     * Sets the reading location within a novel (EPUB).
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the chapter index and CFI string.
     */
    setNovelLocation: (state, action: PayloadAction<{ index: number; cfi: string }>) => {
      state.containerFile.index = action.payload.index;
      state.containerFile.cfi = action.payload.cfi;
    },
    /**
     * Clears any error associated with the container file state.
     *
     * @param state - The current Redux state slice.
     */
    clearContainerFileError: (state) => {
      state.containerFile.error = null;
    },
    /**
     * Clears any error associated with the file explorer state.
     *
     * @param state - The current Redux state slice.
     */
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
        state.explorer.error = action.payload ?? null;
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
            isNovel: boolean;
            book: BookWithState | null;
          }>,
        ) => {
          if (action.payload.entries) {
            state.containerFile.entries = action.payload.entries;
          }
          state.containerFile.isDirectory = action.payload.isDirectory;
          state.containerFile.isLoading = false;
          state.containerFile.book = action.payload.book;
          state.containerFile.index = action.payload.book?.last_read_page_index ?? 0;
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
        state.containerFile.error = action.payload ?? null;
      });
  },
});

export const {
  setContainerFilePath,
  setImageIndex,
  setExploreBasePath,
  setSearchText,
  goBackContainerHistory,
  goForwardContainerHistory,
  goBackExplorerHistory,
  goForwardExplorerHistory,
  setIsDirEntriesLoading,
  setEntries,
  setNovelLocation,
  clearContainerFileError,
  clearExplorerError,
} = readSlice.actions;
export default readSlice.reducer;
