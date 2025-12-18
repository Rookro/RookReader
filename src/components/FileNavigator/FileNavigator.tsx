import { CSSProperties, memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { List, RowComponentProps, useListRef } from 'react-window';
import { Box, ListItem, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import { Folder, InsertDriveFile } from '@mui/icons-material';
import { basename, join } from '@tauri-apps/api/path';
import { watch } from '@tauri-apps/plugin-fs';
import { error } from '@tauri-apps/plugin-log';
import { useAppSelector, useAppDispatch } from '../../Store';
import { getEntriesInDir, setContainerFilePath, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import { SortOrder } from '../../types/SortOrderType';
import { DirEntry } from '../../types/DirEntry';
import NavBar from './NavBar';

/**
 * Filters an array of DirEntry objects to find entries whose 'name' property contains ALL specified keywords (AND search).
 * Keywords are derived from the user's input string, separated by whitespace (including full-width spaces).
 *
 * The search is case-insensitive.
 *
 * @param entries - The array of DirEntry objects to be searched.
 * @param query - The user's input string containing one or more space-separated keywords.
 * @returns A new array containing only the DirEntry objects whose 'name' property matches all provided keywords. 
 * Returns the original array if the query is empty or contains only whitespace.
 *
 * @example
 * const entries = [{ name: "test_dir", ... }, { name: "test_file", ... }];
 * andSearch(entries, "test file"); // Returns [{ name: "test_file", ... }]
 * andSearch(entries, "example"); // Returns []
 */
const addSearch = (entries: DirEntry[], query: string) => {
    const keywords = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(keyword => keyword.length > 0);

    if (keywords.length === 0) {
        return entries;
    }

    const filtered = entries.filter(item => {
        const lowerCaseName = item.name.toLowerCase();
        return keywords.every(keyword => {
            return lowerCaseName.includes(keyword);
        });
    });

    return filtered;
}

/**
 * Comparison function for sorting an array of DirEntry objects based on a specified criterion and order.
 *
 * This function is designed to be passed directly to the native JavaScript Array.prototype.sort() method.
 *
 * @param a - The first DirEntry object for comparison.
 * @param b - The second DirEntry object for comparison.
 * @param sortOrder - The specified criterion (e.g., 'NAME_ASC', 'DATE_DESC') for sorting.
 * @returns A number indicating the sort order:
 * - A negative number if 'a' should come before 'b'.
 * - Zero if 'a' and 'b' are considered equal for sorting.
 * - A positive number if 'a' should come after 'b'.
 *
 * @example
 * const entries: DirEntry[] = [{ name: "b", ... }, { name: "c", ... }, { name: "a", ... }];
 * entries.sort((a, b) => sortBy(a, b, 'NAME_ASC'));  // Returns [{ name: "a", ... }, { name: "b", ... }, { name: "c", ... }]
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
 * File navigator component.
 */
export default function FileListViewer() {
    const { history, historyIndex, entries, searchText, sortOrder } = useAppSelector(state => state.file.explorer);
    const { history: fileHistory, historyIndex: fileHistoryIndex } = useAppSelector(state => state.file.containerFile);
    const dispatch = useAppDispatch();

    const [selectedIndex, setSelectedIndex] = useState(-1);

    const listRef = useListRef(null);
    const watcherRef = useRef<null | (() => void)>(null);

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

    // Updates the entries in the directory.
    useEffect(() => {
        const updateEntries = async () => {
            const dirPath = history[historyIndex];

            dispatch(getEntriesInDir(dirPath));
            setSelectedIndex(-1);

            let unwatch = null;
            try {
                unwatch = await watch(dirPath, (event) => {
                    if (typeof event.type === 'object' && ('create' in event.type || 'modify' in event.type || 'remove' in event.type)) {
                        dispatch(getEntriesInDir(dirPath));
                    }
                }, { delayMs: 500 });
            } catch (e) {
                error(`Failed to watch ${dirPath}. Error: ${e}`);
            }

            watcherRef.current?.();
            watcherRef.current = unwatch;
        };
        updateEntries();

        return () => {
            watcherRef.current?.();
        };
    }, [history, historyIndex, dispatch]);

    const filteredSortedEntries = useMemo(() => {
        return addSearch(entries, searchText).slice().sort((a, b) => sortBy(a, b, sortOrder));
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
