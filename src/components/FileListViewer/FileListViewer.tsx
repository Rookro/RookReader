import { CSSProperties, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { List, RowComponentProps, useListRef } from 'react-window';
import { Box, ListItem, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import { Folder, InsertDriveFile } from '@mui/icons-material';
import { basename, join } from '@tauri-apps/api/path';
import { useSelector, useAppDispatch } from '../../Store';
import { getEntriesInDir, setContainerFilePath, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import { SortOrder } from '../../types/SortOrderType';
import { DirEntry } from '../../types/DirEntry';
import NavBar from './NavBar';

/**
 * Sorts directory entries.
 * 
 * @param a - The first entry to compare.
 * @param b - The second entry to compare.
 * @param sortOrder - The sort order.
 * @returns Sorted directory entries.
 */
const sortBy = (a: DirEntry, b: DirEntry, sortOrder: SortOrder) => {
    switch (sortOrder) {
        case "NAME_ASC":
            return a.name.localeCompare(b.name);
        case "NAME_DESC":
            return b.name.localeCompare(a.name);
        case "DATE_ASC":
            return Date.parse(a.last_modified) - Date.parse(b.last_modified);
        case 'DATE_DESC':
            return Date.parse(b.last_modified) - Date.parse(a.last_modified);
    }
}

/**
 * Row component for the file list.
 */
const ItemRow = memo(function ItemRow({
    entry,
    index,
    selected,
    onClick,
    onDoubleClick,
    style
}: {
    entry: DirEntry;
    index: number;
    selected: boolean;
    onClick: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => void;
    onDoubleClick: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => void;
    style: CSSProperties | undefined
}) {
    return (
        <Tooltip title={entry.name} placement="right-start">
            <ListItem style={style} key={index} component="div" disablePadding dense>
                <ListItemButton
                    selected={selected}
                    onClick={(e) => onClick(e, entry, index)}
                    onDoubleClick={(e) => onDoubleClick(e, entry)}
                    key={entry.name}
                >
                    {entry.is_directory ? <Folder /> : <InsertDriveFile />}
                    <ListItemText primary={entry.name} slotProps={{ primary: { noWrap: true } }} sx={{ marginLeft: "5px" }} />
                </ListItemButton>
            </ListItem>
        </Tooltip>
    );
});

/** 
 * File list viewer component.
 */
export default function FileListViewer() {
    const { history, historyIndex, entries, searchText, sortOrder } = useSelector(state => state.file.explorer);
    const { history: fileHistory, historyIndex: fileHistoryIndex } = useSelector(state => state.file.containerFile);
    const dispatch = useAppDispatch();

    const [selectedIndex, setSelectedIndex] = useState(-1);

    const listRef = useListRef(null);

    // Scroll to make the selected item visible
    useEffect(() => {
        if (entries.length < 1 || selectedIndex === -1) {
            return;
        }

        const list = listRef.current;
        list?.scrollToRow({
            align: "smart",
            behavior: "instant",
            index: selectedIndex
        });
    }, [selectedIndex, entries]);

    useEffect(() => {
        dispatch(getEntriesInDir(history[historyIndex]));
        setSelectedIndex(-1);
    }, [history, historyIndex, dispatch]);

    const filteredSortedEntries = useMemo(() => {
        const sorted = [...entries].sort((a, b) => sortBy(a, b, sortOrder));
        if (searchText) {
            const lower = searchText.toLowerCase();
            return sorted.filter((entry) => entry.name.toLowerCase().includes(lower));
        }
        return sorted;
    }, [entries, sortOrder, searchText]);

    useEffect(() => {
        let cancelled = false;
        const initSelected = async () => {
            if (!fileHistory[fileHistoryIndex]) {
                if (!cancelled) {
                    setSelectedIndex(-1);
                }
                return;
            }
            const fileName = await basename(fileHistory[fileHistoryIndex]);
            const idx = filteredSortedEntries.findIndex((entry) => entry.name === fileName);
            if (!cancelled) {
                setSelectedIndex(idx);
            }
        };
        initSelected();
        return () => { cancelled = true; };
    }, [fileHistory, fileHistoryIndex, filteredSortedEntries]);

    const handleListItemClicked = useCallback(
        async (_e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => {
            const path = await join(history[historyIndex], entry.name);
            dispatch(setContainerFilePath(path));
            setSelectedIndex(index);
        },
        [dispatch, history, historyIndex]
    );

    const handleListItemDoubleClicked = useCallback(
        async (_e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => {
            if (entry.is_directory) {
                const path = await join(history[historyIndex], entry.name);
                dispatch(setSearchText(""));
                dispatch(setExploreBasePath(path));
            }
        },
        [dispatch, history, historyIndex]
    );

    const Row = ({
        index,
        entries,
        style
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
                onClick={handleListItemClicked}
                onDoubleClick={handleListItemDoubleClicked}
                style={style}
            />
        );
    }

    return (
        <Stack
            sx={{
                width: "100%",
                height: "100%",
                display: 'grid',
                alignContent: 'start',
            }}
        >
            <NavBar />
            <Box sx={{ height: 'auto', overflow: 'auto' }}>
                <List
                    rowComponent={Row}
                    rowProps={{ entries: filteredSortedEntries }}
                    rowCount={filteredSortedEntries.length}
                    rowHeight={36}
                    overscanCount={5}
                    listRef={listRef}
                />
            </Box>
        </Stack>
    );
}
