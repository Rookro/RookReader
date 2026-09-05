import { Box, Stack, Typography } from "@mui/material";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { List, type RowComponentProps, useListCallbackRef } from "react-window";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import SidePanelHeader from "../../../SidePane/components/SidePanelHeader";
import { setImageIndex } from "../../slice";
import { ItemRow } from "./ItemRow";

/** Props for the row component. */
interface RowProps {
  entries: string[];
  selectedIndex: number;
  /** Whether the selected page is displayed alongside the page after it. */
  isSpreadSelected: boolean;
  onClick: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
}

/** Component to display a single row in the image entries list. */
function Row({
  index,
  entries,
  style,
  selectedIndex,
  isSpreadSelected,
  onClick,
  ...others
}: RowComponentProps<RowProps>) {
  const entry = entries[index];
  // A spread puts the page after the selected one on screen too, so both are selected.
  const isPaired = isSpreadSelected && selectedIndex >= 0 && index === selectedIndex + 1;
  return (
    <ItemRow
      {...others}
      key={entry}
      entry={entry}
      index={index}
      selected={selectedIndex === index || isPaired}
      onClick={onClick}
      style={style}
    />
  );
}

/**
 * Component to display a list of image entries.
 */
export default function ImageEntriesViewer() {
  const { t } = useTranslation();
  const entries = useAppSelector((state) => state.read.containerFile.entries);
  const index = useAppSelector((state) => state.read.containerFile.index);
  const isSpreadDisplayed = useAppSelector((state) => state.read.containerFile.isSpreadDisplayed);
  const dispatch = useAppDispatch();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [list, setList] = useListCallbackRef(null);

  useEffect(() => {
    setSelectedIndex(index);
  }, [index]);

  // Scroll to make the selected item visible.
  useEffect(() => {
    if (selectedIndex === -1 || entries.length === 0 || !list) {
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
        error(`Failed to scroll to row ${selectedIndex} (List length: ${entries.length}): ${e}`);
      }
    }, 20);

    return () => {
      clearTimeout(timerId);
    };
  }, [selectedIndex, entries.length, list]);

  const handleListItemClicked = useCallback(
    (_e: React.MouseEvent<HTMLDivElement>, index: number) => {
      setSelectedIndex(index);
      dispatch(setImageIndex(index));
    },
    [dispatch],
  );

  const rowData: RowProps = useMemo(
    () => ({
      entries,
      selectedIndex,
      isSpreadSelected: isSpreadDisplayed,
      onClick: handleListItemClicked,
    }),
    [entries, selectedIndex, isSpreadDisplayed, handleListItemClicked],
  );

  return (
    <Stack
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <SidePanelHeader title={t("book-reader.pages-viewer.title")} />
      {entries.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {t("book-reader.pages-viewer.no-pages")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          <List
            rowComponent={Row}
            rowProps={rowData}
            rowCount={entries.length}
            rowHeight={36}
            overscanCount={5}
            listRef={setList}
          />
        </Box>
      )}
    </Stack>
  );
}
