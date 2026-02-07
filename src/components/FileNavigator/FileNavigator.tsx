import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { List, RowComponentProps, useListRef } from "react-window";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { join } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";
import { useAppSelector, useAppDispatch } from "../../Store";
import {
  setContainerFilePath,
  setSearchText,
  updateExploreBasePath,
} from "../../reducers/FileReducer";
import { andSearch, sortBy } from "../../utils/FileNavigatorUtils";
import NavBar from "./NavBar";
import { ItemRow } from "./ItemRow";
import { DirEntry } from "../../types/DirEntry";
import { useDirectoryWatcher } from "../../hooks/useDirectoryWatcher";
import { useFileSelection } from "../../hooks/useFileSelection";
import SidePanelHeader from "../SidePane/SidePanelHeader";

/**
 * File navigator component.
 */
export default function FileListViewer() {
  const { t } = useTranslation();
  const { history, historyIndex, entries, searchText, sortOrder, isLoading } = useAppSelector(
    (state) => state.file.explorer,
  );
  const { history: fileHistory, historyIndex: fileHistoryIndex } = useAppSelector(
    (state) => state.file.containerFile,
  );
  const dispatch = useAppDispatch();

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useListRef(null);
  const clickTimer = useRef<number | null>(null);
  const doubleClickIntervalMs = 200;

  const filteredSortedEntries = useMemo(() => {
    return andSearch(entries, searchText)
      .slice()
      .sort((a, b) => sortBy(a, b, sortOrder));
  }, [entries, sortOrder, searchText]);

  const updateEntriesCallback = useCallback(() => {
    if (history[historyIndex]) {
      dispatch(updateExploreBasePath({ dirPath: history[historyIndex], forceUpdate: true }));
    }
  }, [history, historyIndex, dispatch]);

  useEffect(() => {
    updateEntriesCallback();
  }, [updateEntriesCallback]);

  useDirectoryWatcher(history[historyIndex], updateEntriesCallback);
  useFileSelection(fileHistory, fileHistoryIndex, filteredSortedEntries, setSelectedIndex);

  // Scroll to make the selected item visible
  useEffect(() => {
    if (selectedIndex === -1) {
      return;
    }

    try {
      listRef.current?.scrollToRow({ align: "smart", behavior: "instant", index: selectedIndex });
    } catch (e) {
      error(`Failed to scroll to row ${selectedIndex}: ${e}`);
    }
  }, [selectedIndex, listRef]);

  const handleListItemClicked = useCallback(
    async (_e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => {
      const path = await join(history[historyIndex], entry.name);
      dispatch(setContainerFilePath(path));
      setSelectedIndex(index);
    },
    [dispatch, history, historyIndex],
  );

  const handleListItemDoubleClicked = useCallback(
    async (_e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => {
      if (entry.is_directory) {
        const path = await join(history[historyIndex], entry.name);
        dispatch(setSearchText(""));
        dispatch(updateExploreBasePath({ dirPath: path }));
      }
    },
    [dispatch, history, historyIndex],
  );

  const handleListItemClickedWrapper = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        handleListItemDoubleClicked(e, entry);
      } else {
        clickTimer.current = window.setTimeout(() => {
          clickTimer.current = null;
          handleListItemClicked(e, entry, index);
        }, doubleClickIntervalMs);
      }
    },
    [handleListItemClicked, handleListItemDoubleClicked],
  );

  const Row = ({
    index,
    entries,
    style,
  }: RowComponentProps<{
    entries: DirEntry[];
  }>) => {
    const entry = entries[index];
    return (
      <ItemRow
        key={entry.name}
        entry={entry}
        index={index}
        selected={selectedIndex === index}
        onClick={handleListItemClickedWrapper}
        style={style}
      />
    );
  };

  return (
    <Stack
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <SidePanelHeader title={t("app.file-navigator.title")} />
      <NavBar />
      {isLoading ? (
        <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <CircularProgress />
        </Box>
      ) : filteredSortedEntries.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {searchText.length > 0
              ? t("app.file-navigator.no-search-results", { searchText })
              : t("app.file-navigator.no-files")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          <List
            rowComponent={Row}
            rowProps={{ entries: filteredSortedEntries }}
            rowCount={filteredSortedEntries.length}
            rowHeight={36}
            overscanCount={5}
            listRef={listRef}
          />
        </Box>
      )}
    </Stack>
  );
}
