import { Box, Stack, Typography } from "@mui/material";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  List,
  type ListImperativeAPI,
  type RowComponentProps,
  useListCallbackRef,
} from "react-window";
import { useListKeyboardNavigation } from "../../../../hooks/useListKeyboardNavigation";
import { usePointerFocusRelease } from "../../../../hooks/usePointerFocusRelease";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import SidePanelHeader from "../../../SidePane/components/SidePanelHeader";
import {
  type PanelFocusRequest,
  useRegisterSidePanel,
  useSidePaneFocus,
} from "../../../SidePane/SidePaneFocusContext";
import { setImageIndex } from "../../slice";
import { ItemRow } from "./ItemRow";

/** Props for the row component. */
interface RowProps {
  entries: string[];
  selectedIndex: number;
  /** Whether the selected page is displayed alongside the page after it. */
  isSpreadSelected: boolean;
  onClick: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
  rowId: (index: number) => string;
  isKeyboardActive: (index: number) => boolean;
}

/** Component to display a single row in the image entries list. */
function Row({
  index,
  entries,
  style,
  selectedIndex,
  isSpreadSelected,
  onClick,
  rowId,
  isKeyboardActive,
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
      id={rowId(index)}
      keyboardActive={isKeyboardActive(index)}
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
  const entries = useAppSelector((state) => state.reader.entries);
  const index = useAppSelector((state) => state.reader.index);
  const isSpreadDisplayed = useAppSelector((state) => state.reader.isSpreadDisplayed);
  const dispatch = useAppDispatch();
  const [selectedIndex, setSelectedIndex] = useState(-1);
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
  const panelPointer = usePointerFocusRelease();
  const { isKeyboardInPane, returnToReader } = useSidePaneFocus();

  const rowKeys = useMemo(() => entries.map((_, i) => i), [entries]);
  const scrollToIndex = useCallback((index: number) => {
    try {
      listApiRef.current?.scrollToRow({ align: "smart", behavior: "instant", index });
    } catch (e) {
      error(`Failed to scroll to row ${index}: ${e}`);
    }
  }, []);
  const nav = useListKeyboardNavigation({
    rowKeys,
    currentKey: entries.length > 0 ? index : null,
    label: t("book-reader.pages-viewer.title"),
    scrollToIndex,
    pageSize: () => Math.max(1, Math.floor((listApiRef.current?.element?.clientHeight ?? 0) / 36)),
    onOpen: (_key, index) => {
      returnToReader();
      setSelectedIndex(index);
      dispatch(setImageIndex(index));
    },
    isKeyboardInUse: isKeyboardInPane,
  });
  const keyboardHasList = nav.hasFocus && isKeyboardInPane;

  useRegisterSidePanel((request: PanelFocusRequest) => {
    if (!nav.focusList(request)) {
      panelRef.current?.focus();
    }
  }, true);

  useEffect(() => {
    setSelectedIndex(index);
  }, [index]);

  // Scroll to make the selected item visible.
  useEffect(() => {
    if (selectedIndex === -1 || entries.length === 0 || !list || keyboardHasList) {
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
  }, [selectedIndex, entries.length, list, keyboardHasList]);

  const { setActiveKey, rowId, isKeyboardActive } = nav;
  const handleListItemClicked = useCallback(
    (_e: React.MouseEvent<HTMLDivElement>, index: number) => {
      setActiveKey(index);
      setSelectedIndex(index);
      dispatch(setImageIndex(index));
    },
    [dispatch, setActiveKey],
  );

  const rowData: RowProps = useMemo(
    () => ({
      entries,
      selectedIndex,
      isSpreadSelected: isSpreadDisplayed,
      onClick: handleListItemClicked,
      rowId,
      isKeyboardActive,
    }),
    [entries, selectedIndex, isSpreadDisplayed, handleListItemClicked, rowId, isKeyboardActive],
  );

  return (
    <Stack
      ref={panelRef}
      tabIndex={-1}
      onPointerDown={panelPointer.onPointerDown}
      onFocus={panelPointer.onFocus}
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
            listRef={handleListRef}
            {...nav.listProps}
            onRowsRendered={nav.onRowsRendered}
          />
        </Box>
      )}
    </Stack>
  );
}
