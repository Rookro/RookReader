import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { createSelector } from "@reduxjs/toolkit";
import { basename, dirname, join } from "@tauri-apps/api/path";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  List,
  type ListImperativeAPI,
  type RowComponentProps,
  useListCallbackRef,
} from "react-window";
import type { DirEntry } from "../../../../domain/entities";
import { useListKeyboardNavigation } from "../../../../hooks/useListKeyboardNavigation";
import { usePointerFocusRelease } from "../../../../hooks/usePointerFocusRelease";
import {
  type RootState,
  useAppDispatch,
  useAppSelector,
  useAppStore,
} from "../../../../store/store";
import { isNavigableArchiveName } from "../../../../utils/ArchivePathUtils";
import SidePanelHeader from "../../../SidePane/components/SidePanelHeader";
import {
  type PanelFocusRequest,
  useRegisterSidePanel,
  useSidePaneFocus,
} from "../../../SidePane/SidePaneFocusContext";
import { loadDirectory, setSearchText } from "../../fileNavigatorSlice";
import { useDirectoryWatcher } from "../../hooks/useDirectoryWatcher";
import { useFileSelection } from "../../hooks/useFileSelection";
import { openBook } from "../../slice";
import { andSearch, sortBy } from "../../utils/FileNavigatorUtils";
import { ItemRow } from "./ItemRow";
import NavBar from "./NavBar";

const selectFileNavigatorState = createSelector(
  [
    (state: RootState) => state.settings.fileNavigator,
    (state: RootState) => state.fileNavigator,
    (state: RootState) => state.reader,
  ],
  (fileNavigatorSettings, fileNavigator, reader) => ({
    fileNavigatorSettings,
    history: fileNavigator.history,
    historyIndex: fileNavigator.historyIndex,
    entries: fileNavigator.entries,
    searchText: fileNavigator.searchText,
    isLoading: fileNavigator.isLoading,
    fileHistory: reader.history,
    fileHistoryIndex: reader.historyIndex,
  }),
);

/** Props for the row component. */
interface RowProps {
  entries: DirEntry[];
  selectedIndex: number;
  onClick: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => void;
  rowId: (index: number) => string;
  isKeyboardActive: (index: number) => boolean;
}

/** Component to display a single row in the file navigator list. */
function Row({
  index,
  entries,
  style,
  selectedIndex,
  onClick,
  rowId,
  isKeyboardActive,
  ...others
}: RowComponentProps<RowProps>) {
  const entry = entries[index];
  return (
    <ItemRow
      {...others}
      key={entry.name}
      entry={entry}
      index={index}
      selected={selectedIndex === index}
      id={rowId(index)}
      keyboardActive={isKeyboardActive(index)}
      onClick={onClick}
      style={style}
    />
  );
}

/**
 * File navigator component.
 */
export default function FileListViewer() {
  const { t } = useTranslation();
  const {
    fileNavigatorSettings,
    history,
    historyIndex,
    entries,
    searchText,
    isLoading,
    fileHistory,
    fileHistoryIndex,
  } = useAppSelector(selectFileNavigatorState);
  const dispatch = useAppDispatch();
  const store = useAppStore();

  // The open book's name; its row follows it when a re-read of the folder moves it.
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [list, setList] = useListCallbackRef(null);
  // `list` is still null in the effects of the first render, where a pending focus request runs.
  const listApiRef = useRef<ListImperativeAPI | null>(null);
  const handleListRef = useCallback(
    (api: ListImperativeAPI | null) => {
      listApiRef.current = api;
      setList(api);
    },
    [setList],
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelPointer = usePointerFocusRelease();
  const { isKeyboardInPane, returnToReader, requestPanelFocus } = useSidePaneFocus();
  // What the list last scrolled for, or found the open book missing for; see the scroll effect.
  const scrolledFor = useRef<string | null>(null);
  const clickTimer = useRef<number | null>(null);
  const pendingIndex = useRef<number | null>(null);
  const doubleClickIntervalMs = 200;

  const filteredSortedEntries = useMemo(() => {
    return andSearch(entries, searchText)
      .slice()
      .sort((a, b) => sortBy(a, b, fileNavigatorSettings.sortOrder));
  }, [entries, fileNavigatorSettings.sortOrder, searchText]);

  const selectedIndex = useMemo(
    () =>
      selectedName === null
        ? -1
        : filteredSortedEntries.findIndex((entry) => entry.name === selectedName),
    [filteredSortedEntries, selectedName],
  );

  const openEntry = useCallback(
    async (entry: DirEntry) => {
      const path = await join(history[historyIndex], entry.name);
      dispatch(openBook({ path, origin: { kind: "fileNavigator" } }));
      setSelectedName(entry.name);
    },
    [dispatch, history, historyIndex],
  );

  // A request that came when the folder had started loading but this panel had not re-rendered,
  // and so still counted as ready; made again once it has, so that it waits for the listing.
  const focusAfterLoad = useRef<PanelFocusRequest | null>(null);
  useEffect(() => {
    if (isLoading && focusAfterLoad.current !== null) {
      requestPanelFocus(focusAfterLoad.current);
      focusAfterLoad.current = null;
    }
  }, [isLoading, requestPanelFocus]);

  const enterFolder = useCallback(
    async (entry: DirEntry) => {
      if (!entry.isDirectory && !isNavigableArchiveName(entry.name)) {
        return;
      }
      const path = await join(history[historyIndex], entry.name);
      dispatch(setSearchText(""));
      dispatch(loadDirectory({ dirPath: path }));
      requestPanelFocus("first");
    },
    [dispatch, history, historyIndex, requestPanelFocus],
  );

  const leaveFolder = useCallback(async () => {
    const current = history[historyIndex];
    let parent: string;
    let left: string;
    try {
      parent = await dirname(current);
      left = await basename(current);
    } catch {
      // At the root, or a path that names no folder.
      return;
    }
    if (!parent || parent === current) {
      return;
    }
    dispatch(loadDirectory({ dirPath: parent }));
    requestPanelFocus({ rowKey: left });
  }, [dispatch, history, historyIndex, requestPanelFocus]);

  // The search field while a search hides every entry, so that it can be changed.
  const focusEmptyTarget = () => {
    (searchText !== "" ? searchInputRef.current : panelRef.current)?.focus();
  };
  const rowKeys = useMemo(() => filteredSortedEntries.map((e) => e.name), [filteredSortedEntries]);
  const scrollToIndex = useCallback((index: number) => {
    try {
      listApiRef.current?.scrollToRow({ align: "smart", behavior: "instant", index });
    } catch (e) {
      error(`Failed to scroll to row ${index}: ${e}`);
    }
  }, []);
  const nav = useListKeyboardNavigation({
    rowKeys,
    currentKey: selectedIndex === -1 ? null : selectedName,
    label: t("book-reader.file-navigator.title"),
    scrollToIndex,
    pageSize: () => Math.max(1, Math.floor((listApiRef.current?.element?.clientHeight ?? 0) / 36)),
    onOpen: (_key, index) => {
      returnToReader();
      openEntry(filteredSortedEntries[index]);
    },
    onEnterRow: (_key, index) => enterFolder(filteredSortedEntries[index]),
    onLeave: leaveFolder,
    onBecameEmpty: focusEmptyTarget,
    isKeyboardInUse: isKeyboardInPane,
  });
  const keyboardHasList = nav.hasFocus && isKeyboardInPane;

  const refreshEntries = useCallback(() => {
    if (history[historyIndex]) {
      dispatch(loadDirectory({ dirPath: history[historyIndex], forceUpdate: true }));
    }
  }, [history, historyIndex, dispatch]);

  // Back and Forward only move the history, so this lists the folder they land on. A move
  // into a folder already lists it; read without subscribing, so that listing settling
  // does not run this again.
  useEffect(() => {
    const { pendingPath } = store.getState().fileNavigator;
    if (pendingPath !== null && pendingPath === history[historyIndex]) {
      return;
    }
    refreshEntries();
  }, [refreshEntries, store, history, historyIndex]);

  // A request made while the folder loads waits for its listing. Registered after the effect
  // above, so that a request pending at mount sees the reload that effect starts.
  useRegisterSidePanel((request: PanelFocusRequest) => {
    if (store.getState().fileNavigator.isLoading) {
      focusAfterLoad.current = request;
      return;
    }
    if (!nav.focusList(request)) {
      focusEmptyTarget();
    }
  }, !isLoading);

  // What the watcher runs: the list stays on screen while the folder is read again.
  const refreshInBackground = useCallback(() => {
    const dirPath = history[historyIndex];
    if (dirPath) {
      return dispatch(loadDirectory({ dirPath, background: true }));
    }
  }, [history, historyIndex, dispatch]);

  useDirectoryWatcher(history[historyIndex], refreshInBackground);
  useFileSelection(fileHistory, fileHistoryIndex, setSelectedName);

  const dirPath = history[historyIndex];
  // Scroll to make the selected item visible when the list is shown, the open book changes,
  // or the search or sort moves it. A background re-read of the folder moves rows too, but
  // leaves the reader's scroll position alone.
  useEffect(() => {
    if (!list) {
      // The list was taken down (loading, nothing to show): scroll again once it is back.
      scrolledFor.current = null;
      return;
    }
    const scrollFor = JSON.stringify([
      dirPath,
      selectedName,
      searchText,
      fileNavigatorSettings.sortOrder,
    ]);
    if (selectedIndex === -1 || filteredSortedEntries.length === 0) {
      // Recorded so that a search that hides the open book and is then cleared scrolls back.
      scrolledFor.current = scrollFor;
      return;
    }
    if (keyboardHasList || scrolledFor.current === scrollFor) {
      return;
    }

    // Use setTimeout to push the scroll command to the end of the event loop.
    // This ensures that the virtualized list (react-window) has finished
    // rendering and measuring item positions before attempting to scroll.
    const timerId = setTimeout(() => {
      scrolledFor.current = scrollFor;
      try {
        debug(`Scrolling to row ${selectedIndex}.`);
        list.scrollToRow({ align: "smart", behavior: "instant", index: selectedIndex });
      } catch (e) {
        error(`Failed to scroll to row ${selectedIndex}: ${e}`);
      }
    }, 20);

    return () => {
      clearTimeout(timerId);
    };
  }, [
    list,
    selectedIndex,
    filteredSortedEntries.length,
    dirPath,
    selectedName,
    searchText,
    fileNavigatorSettings.sortOrder,
    keyboardHasList,
  ]);

  const handleListItemClicked = useCallback(
    (_e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, _index: number) => {
      openEntry(entry);
    },
    [openEntry],
  );

  // Only folders and browsable archives wait for a double-click; it enters them like a
  // folder, and a single click still opens them as a book.
  const handleListItemDoubleClicked = useCallback(
    async (entry: DirEntry) => {
      const path = await join(history[historyIndex], entry.name);
      dispatch(setSearchText(""));
      dispatch(loadDirectory({ dirPath: path }));
    },
    [dispatch, history, historyIndex],
  );

  const { setActiveKey, rowId, isKeyboardActive } = nav;
  const handleListItemClickedWrapper = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => {
      setActiveKey(entry.name);
      // A file with no double-click action opens at once.
      if (!entry.isDirectory && !isNavigableArchiveName(entry.name)) {
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
          pendingIndex.current = null;
        }
        handleListItemClicked(e, entry, index);
        return;
      }
      // Only treat a second click as a double-click when it lands on the same row;
      // a click on a different row restarts the single-click timer for that row.
      if (clickTimer.current && pendingIndex.current === index) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        pendingIndex.current = null;
        handleListItemDoubleClicked(entry);
      } else {
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
        }
        pendingIndex.current = index;
        clickTimer.current = window.setTimeout(() => {
          clickTimer.current = null;
          pendingIndex.current = null;
          handleListItemClicked(e, entry, index);
        }, doubleClickIntervalMs);
      }
    },
    [handleListItemClicked, handleListItemDoubleClicked, setActiveKey],
  );

  // Cancel any pending single-click callback when the component unmounts.
  useEffect(() => {
    return () => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
    };
  }, []);

  const rowData: RowProps = useMemo(
    () => ({
      entries: filteredSortedEntries,
      selectedIndex,
      onClick: handleListItemClickedWrapper,
      rowId,
      isKeyboardActive,
    }),
    [filteredSortedEntries, selectedIndex, handleListItemClickedWrapper, rowId, isKeyboardActive],
  );

  // The panel has focus only as the target of an empty folder, which ← leaves.
  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === "ArrowLeft" &&
      e.target === e.currentTarget &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey
    ) {
      e.preventDefault();
      leaveFolder();
    }
  };

  return (
    <Stack
      ref={panelRef}
      tabIndex={-1}
      onPointerDown={panelPointer.onPointerDown}
      onFocus={panelPointer.onFocus}
      onKeyDown={handlePanelKeyDown}
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <SidePanelHeader title={t("book-reader.file-navigator.title")} />
      <NavBar searchInputRef={searchInputRef} />
      {isLoading ? (
        <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <CircularProgress />
        </Box>
      ) : filteredSortedEntries.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {searchText.length > 0
              ? t("book-reader.file-navigator.no-search-results", { searchText })
              : t("book-reader.file-navigator.no-files")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          <List
            rowComponent={Row}
            rowProps={rowData}
            rowCount={filteredSortedEntries.length}
            rowHeight={36}
            overscanCount={5}
            listRef={handleListRef}
            {...nav.listProps}
            onRowsRendered={nav.onRowsRendered}
          />
        </Box>
      )}
    </Stack>
  );
}
