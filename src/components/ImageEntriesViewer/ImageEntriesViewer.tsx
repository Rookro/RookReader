import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { List, RowComponentProps, useListRef } from "react-window";
import { Box } from "@mui/material";
import { useAppSelector, AppDispatch } from "../../Store";
import { setImageIndex } from "../../reducers/FileReducer";
import { ItemRow } from "./ItemRow";

/**
 * Component to display a list of image entries.
 */
export default function ImageEntriesViewer() {
  const { entries, index } = useAppSelector((state) => state.file.containerFile);
  const dispatch = useDispatch<AppDispatch>();

  const [selectedIndex, setSelectedIndex] = useState(-1);

  const listRef = useListRef(null);

  useEffect(() => {
    setSelectedIndex(index);
  }, [index]);

  // Scroll to make the selected item visible.
  useEffect(() => {
    if (selectedIndex === -1) {
      return;
    }

    try {
      listRef.current?.scrollToRow({ align: "smart", behavior: "instant", index: selectedIndex });
    } catch (e) {
      console.error(
        `Failed to scroll to row ${selectedIndex} (List length: ${entries.length}): ${e}`,
      );
    }
  }, [selectedIndex, entries.length, listRef]);

  const handleListItemClicked = useCallback(
    (_e: React.MouseEvent<HTMLDivElement>, index: number) => {
      setSelectedIndex(index);
      dispatch(setImageIndex(index));
    },
    [dispatch],
  );

  const Row = ({
    index,
    entries,
    style,
  }: RowComponentProps<{
    entries: string[];
  }>) => {
    const entry = entries[index];
    return (
      <ItemRow
        key={entry}
        entry={entry}
        index={index}
        selected={selectedIndex === index}
        onClick={handleListItemClicked}
        style={style}
      />
    );
  };

  return (
    <Box sx={{ width: "100%", height: "100%", display: "grid", alignContent: "start" }}>
      <List
        rowComponent={Row}
        rowCount={entries.length}
        rowHeight={36}
        rowProps={{ entries }}
        listRef={listRef}
      />
    </Box>
  );
}
