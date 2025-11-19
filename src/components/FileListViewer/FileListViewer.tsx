import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Box, List, ListItemButton, ListItemText } from '@mui/material';
import { Folder, InsertDriveFile } from '@mui/icons-material';
import { basename, join } from '@tauri-apps/api/path';
import { useSelector, AppDispatch } from '../../Store';
import { getEntriesInDir, setContainerFilePath, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import { SortOrder } from '../../types/SortOrderType';
import { DirEntry } from '../../types/DirEntry';
import NavBar from './NavBar';
import "./FileListViewer.css";

/**
 * エントリーのソートを行う
 * 
 * @param a - 比較するエントリー1
 * @param b - 比較するエントリー2
 * @param sortOrder - ソート順序
 * @returns ソート結果
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
 * ファイルリストの行コンポーネント
 */
const ItemRow = memo(function ItemRow({
    entry,
    index,
    selected,
    onFocus,
    onClick,
    onDoubleClick,
    refCallback,
}: {
    entry: DirEntry;
    index: number;
    selected: boolean;
    onFocus: (e: React.FocusEvent, i: number) => void;
    onClick: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => void;
    onDoubleClick: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => void;
    refCallback: (el: HTMLDivElement | null) => void;
}) {
    return (
        <ListItemButton
            selected={selected}
            onFocus={(e) => onFocus(e, index)}
            onClick={(e) => onClick(e, entry)}
            onDoubleClick={(e) => onDoubleClick(e, entry)}
            key={entry.name}
            ref={refCallback}
        >
            {entry.is_directory ? <Folder /> : <InsertDriveFile />}
            <ListItemText primary={entry.name} sx={{ marginLeft: "5px" }} />
        </ListItemButton>
    );
});

/** 
 * ファイルリスト表示コンポネント 
 */
function FileListViewer() {
    const { history, historyIndex, entries, searchText, sortOrder } = useSelector(state => state.file.explorer);
    const { history: fileHistory, historyIndex: fileHistoryIndex } = useSelector(state => state.file.containerFile);
    const dispatch = useDispatch<AppDispatch>();

    const [selectedIndex, setSelectedIndex] = useState(-1);

    const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // 選択している項目が表示されるようにスクロールする
    useEffect(() => {
        const selectedItemRef = itemRefs.current[selectedIndex];
        if (selectedItemRef) {
            selectedItemRef.scrollIntoView({
                behavior: 'instant',
                block: 'nearest',
            });
        }
    }, [selectedIndex]);

    useEffect(() => {
        dispatch(getEntriesInDir(history[historyIndex]));
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

    const handleListItemFocused = useCallback(
        (_e: React.FocusEvent, index: number) => {
            setSelectedIndex(index);
        },
        []
    );

    const handleListItemClicked = useCallback(
        async (_e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => {
            const path = await join(history[historyIndex], entry.name);
            dispatch(setContainerFilePath(path));
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

    return (
        <Box sx={{ width: "100%", display: 'grid', alignContent: 'start' }}>
            <NavBar />
            <List className="file_list" component="nav" dense={true}>
                {filteredSortedEntries.map((entry, index) =>
                    <ItemRow
                        key={entry.name}
                        entry={entry}
                        index={index}
                        selected={selectedIndex === index}
                        onFocus={handleListItemFocused}
                        onClick={handleListItemClicked}
                        onDoubleClick={handleListItemDoubleClicked}
                        refCallback={(el: HTMLDivElement | null) => { itemRefs.current[index] = el; }}
                    />
                )}
            </List>
        </Box >
    );
}

export default FileListViewer;
