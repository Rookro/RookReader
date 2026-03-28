import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { List, RowComponentProps, useListCallbackRef } from "react-window";
import { Box, InputAdornment, OutlinedInput, Stack, Typography } from "@mui/material";
import { Search } from "@mui/icons-material";
import { debug, error } from "@tauri-apps/plugin-log";
import { ItemRow } from "./ItemRow";
import { setContainerFilePath } from "../../../reducers/ReadReducer";
import { useAppDispatch, useAppSelector } from "../../../Store";
import { useHistorySelection } from "../../../hooks/useHistorySelection";
import { andSearch } from "../../../utils/HistoryViewerUtils";
import SidePanelHeader from "../../SidePane/SidePanelHeader";
import { useHistoryEntriesUpdater } from "../../../hooks/useHistoryEntriesUpdater";
import { ReadBook } from "../../../types/DatabaseModels";

/**
 * History viewer component.
 */
export default function HistoryViewer() {
  const { t } = useTranslation();
  const { history, historyIndex } = useAppSelector((state) => state.read.containerFile);
  const { recentlyReadBooks } = useAppSelector((state) => state.history);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchText, setSearchText] = useState("");
  const [list, setList] = useListCallbackRef(null);
  const dispatch = useAppDispatch();

  const filteredEntries = useMemo(() => {
    return andSearch(recentlyReadBooks, searchText);
  }, [recentlyReadBooks, searchText]);

  useHistoryEntriesUpdater();
  useHistorySelection(history[historyIndex], filteredEntries, setSelectedIndex);

  // Scroll to make the selected item visible
  useEffect(() => {
    if (selectedIndex === -1 || filteredEntries.length === 0 || !list) {
      return;
    }

    // Use setTimeout to push the scroll command to the end of the event loop.
    // This ensures that the virtualized list (react-window) has finished
    // rendering and measuring item positions before attempting to scroll.
    const timerId = setTimeout(() => {
      try {
        debug(`Scrolling to row ${selectedIndex}.`);
        list.scrollToRow({ align: "smart", behavior: "instant", index: selectedIndex });
      } catch (e) {
        error(
          `Failed to scroll to row ${selectedIndex} (List length: ${filteredEntries.length}): ${e}`,
        );
      }
    }, 0);

    return () => {
      clearTimeout(timerId);
    };
  }, [selectedIndex, filteredEntries.length, list]);

  const handleListItemClicked = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, entry: ReadBook, index: number) => {
      setSelectedIndex(index);
      dispatch(setContainerFilePath(entry.file_path));
    },
    [dispatch],
  );

  const handleSearchTextChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  const Row = useCallback(
    ({
      index,
      entries,
      style,
    }: RowComponentProps<{
      entries: ReadBook[];
    }>) => {
      const entry = entries[index];
      return (
        <ItemRow
          key={entry.display_name}
          entry={entry}
          index={index}
          selected={selectedIndex === index}
          onClick={handleListItemClicked}
          style={style}
        />
      );
    },
    [selectedIndex, handleListItemClicked],
  );

  return (
    <Stack
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <SidePanelHeader title={t("book-reader.history-viewer.title")} />
      <OutlinedInput
        type="search"
        value={searchText}
        onChange={handleSearchTextChanged}
        onContextMenu={handleContextMenu}
        size="small"
        fullWidth
        sx={{
          paddingLeft: "4px",
          "& .MuiOutlinedInput-input": {
            padding: "4px 8px 4px 4px",
          },
        }}
        startAdornment={
          <InputAdornment position="start" sx={{ marginRight: "0px" }}>
            <Search />
          </InputAdornment>
        }
      />
      {filteredEntries.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {searchText.length > 0
              ? t("book-reader.history-viewer.no-search-results", { searchText })
              : t("book-reader.history-viewer.no-history")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          <List
            rowComponent={Row}
            rowProps={{ entries: filteredEntries }}
            rowCount={filteredEntries.length}
            rowHeight={36}
            overscanCount={5}
            listRef={setList}
          />
        </Box>
      )}
    </Stack>
  );
}
