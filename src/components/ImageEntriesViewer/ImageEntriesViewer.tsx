import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { List, RowComponentProps, useListCallbackRef } from "react-window";
import { Box, Typography } from "@mui/material";
import { debug, error } from "@tauri-apps/plugin-log";
import { useAppSelector, AppDispatch } from "../../Store";
import { setImageIndex } from "../../reducers/FileReducer";
import { ItemRow } from "./ItemRow";
import SidePanelHeader from "../SidePane/SidePanelHeader";
import { useTranslation } from "react-i18next";

/**
 * Component to display a list of image entries.
 */
export default function ImageEntriesViewer() {
  const { t } = useTranslation();
  const { entries, index } = useAppSelector((state) => state.file.containerFile);
  const dispatch = useDispatch<AppDispatch>();
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
    }, 0);

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
      <SidePanelHeader title={t("app.pages-viewer.title")} />
      {entries.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {t("app.pages-viewer.no-pages")}
          </Typography>
        </Box>
      ) : (
        <List
          rowComponent={Row}
          rowCount={entries.length}
          rowHeight={36}
          rowProps={{ entries }}
          listRef={setList}
        />
      )}
    </Box>
  );
}
