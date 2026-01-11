import { useCallback, useEffect, useMemo, useState } from "react";
import { List, RowComponentProps, useListRef } from "react-window";
import { Box, InputAdornment, OutlinedInput, Stack } from "@mui/material";
import { Search } from "@mui/icons-material";
import { error } from "@tauri-apps/plugin-log";
import { ItemRow } from "./ItemRow";
import { HistoryEntry } from "../../types/HistoryEntry";
import { setContainerFilePath } from "../../reducers/FileReducer";
import { useAppDispatch, useAppSelector } from "../../Store";
import { useHistorySelection } from "../../hooks/useHistorySelection";
import { andSearch } from "../../utils/HistoryViewerUtils";

/**
 * History viewer component.
 */
export default function HistoryViewer() {
  const { history, historyIndex } = useAppSelector((state) => state.file.containerFile);
  const { entries } = useAppSelector((state) => state.history);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchText, setSearchText] = useState("");
  const listRef = useListRef(null);
  const dispatch = useAppDispatch();

  const filteredEntries = useMemo(() => {
    return andSearch(entries, searchText);
  }, [entries, searchText]);

  useHistorySelection(history[historyIndex], filteredEntries, setSelectedIndex);

  // Scroll to make the selected item visible
  useEffect(() => {
    if (selectedIndex === -1) {
      return;
    }

    try {
      listRef.current?.scrollToRow({ align: "smart", behavior: "instant", index: selectedIndex });
    } catch (e) {
      error(
        `Failed to scroll to row ${selectedIndex} (List length: ${filteredEntries.length}): ${e}`,
      );
    }
  }, [selectedIndex, listRef, filteredEntries]);

  const handleListItemClicked = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, entry: HistoryEntry, index: number) => {
      setSelectedIndex(index);
      dispatch(setContainerFilePath(entry.path));
    },
    [dispatch],
  );

  const handleSearchTextChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  };

  const Row = ({
    index,
    entries,
    style,
  }: RowComponentProps<{
    entries: HistoryEntry[];
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
  };

  return (
    <Stack
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
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
      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        <List
          rowComponent={Row}
          rowProps={{ entries: filteredEntries }}
          rowCount={filteredEntries.length}
          rowHeight={36}
          overscanCount={5}
          listRef={listRef}
        />
      </Box>
    </Stack>
  );
}
