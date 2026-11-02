import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { dirname } from "@tauri-apps/api/path";
import { debug, error, info } from "@tauri-apps/plugin-log";
import {
  getRecentlyReadBooks,
  recordBookOpened,
  updateReadingDirection,
  updateSpreadShift,
} from "../../bindings/BookCommands";
import { openContainer, requestPreloadAround } from "../../bindings/ContainerCommands";
import type { BookWithState } from "../../domain/entities";
import { handleThunkError } from "../../store/thunkErrorHandler";
import type { Direction } from "../../types/AppSettings";
import { createAppAsyncThunk, type ThunkRejectValue } from "../../types/CustomAsyncThunk";
import { CommandError, createCommandError, ErrorCode } from "../../types/Error";
import { updateExploreBasePath } from "./fileNavigatorSlice";
import type { OpenOrigin } from "./types/OpenOrigin";
import { goBackHistory, goForwardHistory, pushHistory } from "./utils/navigationHistory";

/**
 * Opens a container file or directory, retrieves its contents, and updates the reading history.
 *
 * @param path - The absolute file path to the container or directory.
 * @returns A thunk that resolves to an object containing entries, directory status, novel status, and book state.
 */
export const openContainerFile = createAppAsyncThunk(
  "reader/openContainerFile",
  async (path: string, { dispatch, rejectWithValue, getState }) => {
    if (!path || path.length === 0) {
      const errorMessage = "Failed to openContainerFile. Error: Container path is empty.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.path, message: errorMessage });
    }
    info(`Open container file: ${path}`);
    try {
      const [entriesResult, dirPath] = await Promise.all([openContainer(path), dirname(path)]);

      const isEpubNovel = entriesResult.is_novel;

      if (!isEpubNovel) {
        debug(
          `openContainerFile: Retrieved ${entriesResult.entries.length} entries. (Container is directory: ${entriesResult.is_directory})`,
        );
      } else {
        debug(`openContainerFile: Epub Novel is opened.`);
      }

      dispatch(updateExploreBasePath({ dirPath }));

      debug(`Update container history: ${path}`);
      // The container is already open here. Failing to remember it in the library is
      // worth telling the user about, but it is not "the book could not be opened", so it
      // is reported apart and the entries are kept.
      let book: BookWithState | null = null;
      let bookRecordError: { code: ErrorCode; message?: string } | null = null;
      try {
        book = await recordBookOpened(path);
      } catch (e) {
        const commandError = createCommandError(e);
        error(`Failed to record the opened book(${path}). Error: ${commandError.message}`);
        bookRecordError = { code: commandError.code, message: commandError.message };
      }

      // The backend gives a comic opened for the first time the default direction.
      // Novels are excluded: their direction is the EPUB's own and cannot be overridden.
      const readingDirection = isEpubNovel ? null : (book?.reading_direction ?? null);

      if (!isEpubNovel) {
        const state = getState();
        const preloadPageCount = state.settings.reader.comic.cache.preloadPageCount;
        const startIndex = book?.last_read_page_index ?? 0;
        // The viewer mounts moments from now and asks for its own unit at foreground
        // priority; leave those pages to it rather than have this window reach them
        // first and make the reader wait on a background job.
        const callerPages = state.settings.reader.comic.enableSpread ? 2 : 1;
        requestPreloadAround(path, startIndex, preloadPageCount, callerPages).catch((e) => {
          error(`Failed to request preload: ${String(e)}`);
        });
      }

      return {
        entries: entriesResult.entries,
        isDirectory: entriesResult.is_directory,
        isNovel: isEpubNovel,
        hasPreviews: entriesResult.has_previews,
        book: book,
        readingDirection,
        bookRecordError,
      };
    } catch (e) {
      // A container with no readable pages is not a book, but the path itself is real.
      // Move the navigator into it so its folders can be opened, rather than leaving the
      // previously opened book on screen and stranding the user there — dropping an
      // archive whose pages all live in sub-folders would otherwise be a dead end.
      // Only folders and browsable archives can be empty this way, and both list their
      // contents, so entering the path is always meaningful.
      //
      // Guarded like the fulfilled/rejected reducers: a slow failure must not drag the
      // navigator away from a book the user opened in the meantime.
      const { history, historyIndex } = getState().reader;
      if (
        history[historyIndex] === path &&
        e instanceof CommandError &&
        e.code === ErrorCode.emptyContainer
      ) {
        dispatch(updateExploreBasePath({ dirPath: path }));
      }
      return handleThunkError(e, `Failed to openContainerFile(${path}).`, rejectWithValue);
    }
  },
);

/**
 * Flips this book's spread pairing and remembers it.
 *
 * Written straight through rather than debounced with the reading progress: it changes on
 * a button press, not on every page turn, and it belongs to the book rather than to the
 * reading history — which the reader can switch off or clear.
 *
 * @returns A thunk that flips the flag and persists it against the open book.
 */
export const toggleSpreadShift = createAppAsyncThunk(
  "reader/toggleSpreadShift",
  async (_: undefined, { getState, dispatch }) => {
    const { isSpreadShifted, book } = getState().reader;
    const next = !isSpreadShifted;
    dispatch(setSpreadShifted(next));
    if (book) {
      try {
        await updateSpreadShift(book.id, next);
      } catch (e) {
        // The flag still applies to this session; only remembering it failed.
        error(`Failed to store the spread shift: ${String(e)}`);
      }
    }
  },
);

/**
 * Flips the open book's page direction and remembers it against that book.
 *
 * Written straight through rather than debounced with the reading progress: it changes on
 * a button press, and it belongs to the book rather than to the reading history — which
 * the reader can switch off or clear. The default in `reader.comic.readingDirection` is
 * left alone; it only seeds books being opened for the first time.
 *
 * @returns A thunk that flips the direction and persists it against the open book.
 */
export const toggleReadingDirection = createAppAsyncThunk(
  "reader/toggleReadingDirection",
  async (_: undefined, { getState, dispatch }) => {
    const state = getState();
    const { readingDirection, book } = state.reader;
    const current = readingDirection ?? state.settings.reader.comic.readingDirection;
    const next: Direction = current === "rtl" ? "ltr" : "rtl";
    dispatch(setReadingDirection(next));
    if (book) {
      try {
        await updateReadingDirection(book.id, next);
      } catch (e) {
        // The direction still applies to this session; only remembering it failed.
        error(`Failed to store the reading direction: ${String(e)}`);
      }
    }
  },
);

const initialState = {
  history: [] as string[],
  historyIndex: -1,
  isDirectory: false,
  entries: [] as string[],
  book: null as BookWithState | null,
  index: 0,
  /**
   * Whether this book's spread pairing is shifted by one relative to the app's
   * cover setting, to line up an archive whose pages are offset.
   */
  isSpreadShifted: false,
  /** Whether the reader is currently showing two pages side by side. */
  isSpreadDisplayed: false,
  /**
   * Page-turn direction of the open comic, restored with the book and seeded from
   * `reader.comic.readingDirection` the first time the book is opened. Null while no
   * book is loaded, and for novels, which report their own direction.
   */
  readingDirection: null as Direction | null,
  cfi: null as string | null,
  isNovel: false,
  /** Whether the open book can send a page's preview more cheaply than the page. */
  hasPreviews: false,
  /**
   * Page-turn direction of the open novel, decided for the book as a whole: its
   * declared page progression direction, or else the writing mode of its body text.
   * Null until the book reports one, and always null for comics, which follow the
   * user's setting.
   */
  novelDirection: null as Direction | null,
  isLoading: false,
  error: null as ThunkRejectValue | null,
  /**
   * Why remembering the opened book in the library failed, if it did. Kept apart
   * from `error`: the book itself is on screen, only its history entry is missing.
   */
  bookRecordError: null as { code: ErrorCode; message?: string } | null,
  /** Where the current book was opened from (used to resolve the adjacent book). */
  origin: null as OpenOrigin | null,
  /** Where each book in `history` was opened from, index-aligned with it. */
  originHistory: [] as (OpenOrigin | null)[],
  /**
   * Overrides the start page of the next opened container, used by adjacent-book
   * navigation: "first" lands on page 1 (next book), "last" lands on the last page
   * (previous book). When null, the last-read position is used.
   */
  pendingInitialPosition: null as "first" | "last" | null,
};

/** The reader's state: the open book, its pages and position, and the book history. */
export type ReaderState = typeof initialState;

/** Clears what the reader shows of a book, before the next one loads or after one fails to. */
const resetBookView = (state: ReaderState) => {
  state.book = null;
  state.entries = [];
  state.index = 0;
  state.isSpreadShifted = false;
  state.isSpreadDisplayed = false;
  state.readingDirection = null;
  state.cfi = null;
  state.novelDirection = null;
  state.hasPreviews = false;
};

export const readerSlice = createSlice({
  name: "reader",
  initialState,
  reducers: {
    /**
     * Moves the book history to a newly opened path and records where it was opened from.
     * Loading the book is left to {@link openBook}.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the path, its origin, and the page to start on.
     */
    bookPathOpened: (
      state,
      action: PayloadAction<{
        path: string;
        origin: OpenOrigin | null;
        initialPosition?: "first" | "last";
      }>,
    ) => {
      const { path, origin, initialPosition } = action.payload;
      state.origin = origin;
      const kept = state.historyIndex + 1;
      if (!pushHistory(state, path)) {
        state.originHistory[state.historyIndex] = origin;
        // No-op open (same path): drop any pending initial position so it can't
        // leak into a later, unrelated open.
        state.pendingInitialPosition = null;
        return;
      }
      state.originHistory = [...state.originHistory.slice(0, kept), origin];
      if (initialPosition) {
        state.pendingInitialPosition = initialPosition;
      }
    },
    /**
     * Sets the current image index within a container file.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the new image index.
     */
    setImageIndex: (state, action: PayloadAction<number>) => {
      // The same section again: a novel stays at its exact position (CFI).
      if (action.payload === state.index) {
        return;
      }
      state.index = action.payload;
      state.cfi = null;
    },
    /**
     * Shifts this book's spread pairing by one, or restores the natural pairing.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing whether the pairing is shifted.
     */
    setSpreadShifted: (state, action: PayloadAction<boolean>) => {
      state.isSpreadShifted = action.payload;
    },
    /**
     * Sets the page direction of the open book.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the direction, or null to fall back to the default.
     */
    setReadingDirection: (state, action: PayloadAction<Direction | null>) => {
      state.readingDirection = action.payload;
    },
    /**
     * Records whether the reader is currently showing a two-page spread, so the page
     * list can highlight both displayed pages.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing whether two pages are on screen.
     */
    setSpreadDisplayed: (state, action: PayloadAction<boolean>) => {
      state.isSpreadDisplayed = action.payload;
    },
    /**
     * Moves one book back in the history. Loading it is left to
     * {@link goBackContainerHistory}.
     *
     * @param state - The current Redux state slice.
     */
    historyMovedBack: (state) => {
      if (goBackHistory(state)) {
        state.origin = state.originHistory[state.historyIndex] ?? null;
      }
    },
    /**
     * Moves one book forward in the history. Loading it is left to
     * {@link goForwardContainerHistory}.
     *
     * @param state - The current Redux state slice.
     */
    historyMovedForward: (state) => {
      if (goForwardHistory(state)) {
        state.origin = state.originHistory[state.historyIndex] ?? null;
      }
    },
    /**
     * Sets the list of entries within the current container file.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing an array of entry strings.
     */
    setEntries: (state, action: PayloadAction<string[]>) => {
      state.entries = action.payload;
    },
    /**
     * Sets the reading location within a novel (EPUB).
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the chapter index and CFI string.
     */
    setNovelLocation: (state, action: PayloadAction<{ index: number; cfi: string }>) => {
      state.index = action.payload.index;
      state.cfi = action.payload.cfi;
    },
    /**
     * Records the page-turn direction detected from the open novel's writing mode.
     *
     * @param state - The current Redux state slice.
     * @param action - Payload containing the detected direction.
     */
    setNovelDirection: (state, action: PayloadAction<Direction>) => {
      state.novelDirection = action.payload;
    },
    /**
     * Clears any error associated with the container file state.
     *
     * @param state - The current Redux state slice.
     */
    clearContainerFileError: (state) => {
      state.error = null;
    },
    /**
     * Clears the error left by a failed attempt to record the opened book.
     *
     * @param state - The current Redux state slice.
     */
    clearBookRecordError: (state) => {
      state.bookRecordError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(openContainerFile.pending, (state) => {
        // Until the next book's record arrives, progress and bookmarks have no book to
        // go to; keeping the previous one would hand them to it.
        resetBookView(state);
        state.isLoading = true;
        state.error = null;
        state.bookRecordError = null;
      })
      .addCase(openContainerFile.fulfilled, (state, action) => {
        // Ignore stale responses: the user may have opened another book before this
        // load finished (mirrors updateExploreBasePath.fulfilled's guard). Without
        // this, a slow earlier open overwrites the newer book's state and progress
        // is then persisted against the wrong book.
        if (state.history[state.historyIndex] !== action.meta.arg) {
          return;
        }
        if (action.payload.entries) {
          state.entries = action.payload.entries;
        }
        state.isDirectory = action.payload.isDirectory;
        state.hasPreviews = action.payload.hasPreviews;
        state.isLoading = false;
        state.book = action.payload.book;
        if (state.pendingInitialPosition === "last") {
          const total = action.payload.entries?.length ?? 0;
          state.index = Math.max(0, total - 1);
          state.cfi = null;
        } else if (state.pendingInitialPosition === "first") {
          state.index = 0;
          state.cfi = null;
        } else {
          // Clamp the restored index so a stale last_read_page_index past the
          // current page count never strands the viewer on a blank page.
          const total = state.entries.length;
          const restored = action.payload.book?.last_read_page_index ?? 0;
          state.index = total > 0 ? Math.min(Math.max(0, restored), total - 1) : 0;
          // Novels resume at the persisted CFI; NovelReader passes it to
          // view.init({ lastLocation }) on mount. Comics never carry a CFI.
          state.cfi = action.payload.isNovel ? (action.payload.book?.cfi ?? null) : null;
        }
        // The reader's own correction to how this book pairs, restored with the book rather
        // than inferred from the restored page, so where they stopped reading does not
        // decide the pairing.
        state.isSpreadShifted = action.payload.book?.is_spread_shifted ?? false;
        state.readingDirection = action.payload.readingDirection;
        state.pendingInitialPosition = null;
        state.error = null;
        state.bookRecordError = action.payload.bookRecordError;
        if (action.payload.isNovel !== undefined) {
          state.isNovel = action.payload.isNovel;
        }
      })
      .addCase(openContainerFile.rejected, (state, action) => {
        // Same staleness guard as fulfilled: a stale rejection must not clobber the
        // newer book's freshly loaded state.
        if (state.history[state.historyIndex] !== action.meta.arg) {
          return;
        }
        // Drop every trace of the previously opened book. The reader is now at the path
        // that failed to open, showing no pages, instead of still showing the old book's
        // title, type and reading state.
        resetBookView(state);
        state.isLoading = false;
        state.pendingInitialPosition = null;
        state.isDirectory = false;
        state.isNovel = false;
        state.error = action.payload ?? null;
      });
  },
});

export const {
  bookPathOpened,
  historyMovedBack,
  historyMovedForward,
  setImageIndex,
  setSpreadShifted,
  setReadingDirection,
  setSpreadDisplayed,
  setEntries,
  setNovelLocation,
  setNovelDirection,
  clearContainerFileError,
  clearBookRecordError,
} = readerSlice.actions;
export default readerSlice.reducer;

/**
 * Opens a book: moves the history to it and, unless it is already the open book, loads it.
 *
 * @param args - The book to open.
 * @param args.path - The absolute path of the container file or directory.
 * @param args.origin - Where the book was opened from, or null for a typed path.
 * @param args.initialPosition - "first" or "last" to start on that page instead of the
 * last-read one.
 * @returns A thunk that resolves once the book has loaded, or at once if it was already open.
 */
export const openBook = createAppAsyncThunk(
  "reader/openBook",
  async (
    {
      path,
      origin,
      initialPosition,
    }: { path: string; origin: OpenOrigin | null; initialPosition?: "first" | "last" },
    { dispatch, getState },
  ) => {
    const { history, historyIndex } = getState().reader;
    const isAlreadyOpen = history[historyIndex] === path;
    dispatch(bookPathOpened({ path, origin, initialPosition }));
    if (!isAlreadyOpen) {
      await dispatch(openContainerFile(path));
    }
  },
);

/**
 * Moves one book back in the history and loads it.
 *
 * @returns A thunk that resolves once the book has loaded, or at once at the first book.
 */
export const goBackContainerHistory = createAppAsyncThunk(
  "reader/goBackContainerHistory",
  async (_: undefined, { dispatch, getState }) => {
    const before = getState().reader.historyIndex;
    dispatch(historyMovedBack());
    const { history, historyIndex } = getState().reader;
    if (historyIndex !== before) {
      await dispatch(openContainerFile(history[historyIndex]));
    }
  },
);

/**
 * Moves one book forward in the history and loads it.
 *
 * @returns A thunk that resolves once the book has loaded, or at once at the last book.
 */
export const goForwardContainerHistory = createAppAsyncThunk(
  "reader/goForwardContainerHistory",
  async (_: undefined, { dispatch, getState }) => {
    const before = getState().reader.historyIndex;
    dispatch(historyMovedForward());
    const { history, historyIndex } = getState().reader;
    if (historyIndex !== before) {
      await dispatch(openContainerFile(history[historyIndex]));
    }
  },
);

/**
 * Opens the most recently read book, when reading history is recorded and the startup
 * setting asks for it.
 *
 * @returns A thunk that resolves once the book has loaded, or at once when there is none
 * to restore.
 */
export const restoreLastBook = createAppAsyncThunk(
  "reader/restoreLastBook",
  async (_: undefined, { dispatch, getState }) => {
    const { history, startup } = getState().settings;
    if (!history.recordReadingHistory || !startup.restoreLastBook) {
      return;
    }
    try {
      const [latest] = await getRecentlyReadBooks();
      if (latest) {
        await dispatch(openBook({ path: latest.file_path, origin: { kind: "startup" } }));
      }
    } catch (e) {
      error(`Failed to restore the last book: ${String(e)}`);
    }
  },
);
