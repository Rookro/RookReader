import { useCallback, useEffect, useMemo, useState } from 'react';
import { List, RowComponentProps, useListRef } from 'react-window';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { join } from '@tauri-apps/api/path';
import { useAppSelector, useAppDispatch } from '../../Store';
import { getEntriesInDir, setContainerFilePath, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import { andSearch, sortBy } from '../../utils/FileNavigatorUtils';
import NavBar from './NavBar';
import { ItemRow } from './ItemRow';
import { DirEntry } from '../../types/DirEntry';
import { useDirectoryWatcher } from '../../hooks/useDirectoryWatcher';
import { useFileSelection } from '../../hooks/useFileSelection';
import { error } from '@tauri-apps/plugin-log';
import { useTranslation } from 'react-i18next';

/**
 * File navigator component.
 */
export default function FileListViewer() {
    const { t } = useTranslation();
    const { history, historyIndex, entries, searchText, sortOrder, isLoading } = useAppSelector(state => state.file.explorer);
    const { history: fileHistory, historyIndex: fileHistoryIndex } = useAppSelector(state => state.file.containerFile);
    const dispatch = useAppDispatch();

    const [selectedIndex, setSelectedIndex] = useState(-1);
    const listRef = useListRef(null);

    const filteredSortedEntries = useMemo(() => {
        return andSearch(entries, searchText).slice().sort((a, b) => sortBy(a, b, sortOrder));
    }, [entries, sortOrder, searchText]);

    const updateEntriesCallback = useCallback(() => {
        const dirPath = history[historyIndex];
        if (dirPath) {
            dispatch(getEntriesInDir(dirPath));
            setSelectedIndex(-1);
        }
    }, [history, historyIndex, dispatch]);

    useDirectoryWatcher(history[historyIndex], updateEntriesCallback);
    useFileSelection(fileHistory, fileHistoryIndex, filteredSortedEntries, setSelectedIndex);

    useEffect(() => {
        updateEntriesCallback();
    }, [updateEntriesCallback]);

    // Scroll to make the selected item visible
    useEffect(() => {
        if (selectedIndex === -1) {
            return;
        }

        try {
            listRef.current?.scrollToRow({ align: "smart", behavior: "instant", index: selectedIndex });
        } catch (e) {
            error(`Failed to scroll to row ${selectedIndex} (List length: ${filteredSortedEntries.length}): ${e}`);
        }
    }, [selectedIndex, listRef]);

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
                height: "100%"
            }}
        >
            <NavBar />
            {isLoading ? (
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            ) : filteredSortedEntries.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography sx={{ overflowWrap: "anywhere" }}>
                        {searchText.length > 0 ? t('app.file-list-viewer.no-search-results', { searchText }) : t('app.file-list-viewer.no-files')}
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
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
