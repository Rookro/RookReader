import DeleteSweep from "@mui/icons-material/DeleteSweep";
import Search from "@mui/icons-material/Search";
import {
  Box,
  IconButton,
  InputAdornment,
  OutlinedInput,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { debug, error } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  List,
  type ListImperativeAPI,
  type RowComponentProps,
  useListCallbackRef,
} from "react-window";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import type { BookWithState } from "../../../../domain/entities";
import { useListKeyboardNavigation } from "../../../../hooks/useListKeyboardNavigation";
import { usePointerFocusRelease } from "../../../../hooks/usePointerFocusRelease";
import { useAppDispatch, useAppSelector } from "../../../../store/store";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";
import { clearAllHistory } from "../../../History/slice";
import SidePanelHeader from "../../../SidePane/components/SidePanelHeader";
import {
  type PanelFocusRequest,
  useRegisterSidePanel,
  useSidePaneFocus,
} from "../../../SidePane/SidePaneFocusContext";
import { useHistoryIndex } from "../../hooks/useHistoryIndex";
import { isComposing } from "../../input/guards";
import { openBook } from "../../slice";
import { andSearch } from "../../utils/HistoryViewerUtils";
import { ItemRow } from "./ItemRow";

/** Props for the row component. */
interface RowProps {
  entries: BookWithState[];
  selectedIndex: number;
  onClick: (e: React.MouseEvent<HTMLElement>, entry: BookWithState, index: number) => void;
  rowId: (index: number) => string;
  isKeyboardActive: (index: number) => boolean;
}

/** Row component for the history viewer. */
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
      key={entry.id}
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
 * History viewer component.
 */
export default function HistoryViewer() {
  const { t } = useTranslation();
  const history = useAppSelector((state) => state.reader.history);
  const historyIndex = useAppSelector((state) => state.reader.historyIndex);
  const recentlyReadBooks = useAppSelector((state) => state.history.recentlyReadBooks);
  const [searchText, setSearchText] = useState("");
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
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
  const { isKeyboardInPane, returnToReader } = useSidePaneFocus();
  const dispatch = useAppDispatch();

  const filteredEntries = useMemo(() => {
    return andSearch(recentlyReadBooks, searchText);
  }, [recentlyReadBooks, searchText]);

  const selectedIndex = useHistoryIndex(history[historyIndex], filteredEntries);

  // The search field while a search hides every entry, so that it can be changed.
  const focusEmptyTarget = () => {
    (searchText !== "" ? searchInputRef.current : panelRef.current)?.focus();
  };
  const rowKeys = useMemo(() => filteredEntries.map((e) => e.id), [filteredEntries]);
  const scrollToIndex = useCallback((index: number) => {
    try {
      listApiRef.current?.scrollToRow({ align: "smart", behavior: "instant", index });
    } catch (e) {
      error(`Failed to scroll to row ${index}: ${e}`);
    }
  }, []);
  const nav = useListKeyboardNavigation({
    rowKeys,
    currentKey: filteredEntries[selectedIndex]?.id ?? null,
    label: t("book-reader.history-viewer.title"),
    scrollToIndex,
    pageSize: () => Math.max(1, Math.floor((listApiRef.current?.element?.clientHeight ?? 0) / 36)),
    onOpen: (_key, index) => {
      returnToReader();
      dispatch(openBook({ path: filteredEntries[index].filePath, origin: { kind: "history" } }));
    },
    onBecameEmpty: focusEmptyTarget,
    isKeyboardInUse: isKeyboardInPane,
  });
  const keyboardHasList = nav.hasFocus && isKeyboardInPane;

  useRegisterSidePanel((request: PanelFocusRequest) => {
    if (!nav.focusList(request)) {
      focusEmptyTarget();
    }
  }, true);

  // Scroll to make the selected item visible
  useEffect(() => {
    if (selectedIndex === -1 || filteredEntries.length === 0 || !list || keyboardHasList) {
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
    }, 20);

    return () => {
      clearTimeout(timerId);
    };
  }, [selectedIndex, filteredEntries.length, list, keyboardHasList]);

  const { setActiveKey, rowId, isKeyboardActive } = nav;
  const handleListItemClicked = useCallback(
    async (_e: React.MouseEvent<HTMLElement>, entry: BookWithState, _index: number) => {
      setActiveKey(entry.id);
      dispatch(openBook({ path: entry.filePath, origin: { kind: "history" } }));
    },
    [dispatch, setActiveKey],
  );

  const handleSearchTextChanged = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  // With nothing to clear, Esc is left to the side pane's keys, which return to the reader.
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape" && searchText !== "" && !isComposing(e.nativeEvent)) {
        e.preventDefault();
        setSearchText("");
      }
    },
    [searchText],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  const handleClearAllConfirmed = useCallback(() => {
    setIsClearAllDialogOpen(false);
    dispatch(clearAllHistory());
  }, [dispatch]);

  const rowProps: RowProps = useMemo(
    () => ({
      entries: filteredEntries,
      selectedIndex,
      onClick: handleListItemClicked,
      rowId,
      isKeyboardActive,
    }),
    [filteredEntries, selectedIndex, handleListItemClicked, rowId, isKeyboardActive],
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
      <SidePanelHeader
        title={t("book-reader.history-viewer.title")}
        actions={
          <Tooltip title={t("book-reader.history-viewer.clear-all")}>
            <span>
              <IconButton
                size="small"
                sx={{ padding: 0 }}
                disabled={recentlyReadBooks.length === 0}
                onClick={(e) => {
                  releaseMouseFocus(e);
                  setIsClearAllDialogOpen(true);
                }}
                aria-label={t("book-reader.history-viewer.clear-all")}
              >
                <DeleteSweep fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        }
      />
      <OutlinedInput
        type="search"
        inputRef={searchInputRef}
        value={searchText}
        onChange={handleSearchTextChanged}
        onKeyDown={handleSearchKeyDown}
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
            rowProps={rowProps}
            rowCount={filteredEntries.length}
            rowHeight={36}
            overscanCount={5}
            listRef={handleListRef}
            {...nav.listProps}
            onRowsRendered={nav.onRowsRendered}
          />
        </Box>
      )}
      <ConfirmDialog
        open={isClearAllDialogOpen}
        title={t("book-reader.history-viewer.clear-all-dialog.title")}
        description={t("book-reader.history-viewer.clear-all-dialog.description")}
        confirmLabel={t("book-reader.history-viewer.clear-all-dialog.confirm")}
        onConfirm={handleClearAllConfirmed}
        onCancel={() => setIsClearAllDialogOpen(false)}
      />
    </Stack>
  );
}
