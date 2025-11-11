import { useEffect, useRef, useState } from 'react';
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
 * ファイルリスト表示コンポネント 
 */
function FileListViewer() {
    const { history, historyIndex, entries, searchText, sortOrder } = useSelector(state => state.file.explorer);
    const { history: fileHistory, historyIndex: fileHistoryIndex } = useSelector(state => state.file.containerFile);
    const dispatch = useDispatch<AppDispatch>();

    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [sortedEntries, setSortedEntries] = useState<DirEntry[]>([]);

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

    useEffect(() => {
        const initEntries = async () => {
            const sortedEntries = [...entries].sort((a, b) => sortBy(a, b, sortOrder));
            setSortedEntries(sortedEntries);

            if (fileHistory[fileHistoryIndex]) {
                const fileName = await basename(fileHistory[fileHistoryIndex]);
                const index = sortedEntries.findIndex((entry) => entry.name === fileName);
                setSelectedIndex(index);
            }
        }
        initEntries();
    }, [entries, fileHistory, fileHistoryIndex, sortOrder])

    const handleListItemFocused = (
        _e: React.FocusEvent,
        index: number,
    ) => {
        setSelectedIndex(index);
    };

    const handleListItemClicked = async (
        _e: React.MouseEvent<HTMLDivElement>,
        entry: DirEntry,
    ) => {
        const path = await join(history[historyIndex], entry.name);
        if (entry.is_directory) {
            dispatch(setSearchText(""));
            dispatch(setExploreBasePath(path));
        } else {
            dispatch(setContainerFilePath(path));
        }
    };

    return (
        <Box sx={{ width: "100%", display: 'grid', alignContent: 'start' }}>
            <NavBar />
            <List className="file_list" component="nav" dense={true}>
                {sortedEntries
                    .filter((entry) => searchText ? entry.name.toLowerCase().includes(searchText.toLowerCase()) : true)
                    .map((entry, index) =>
                        <ListItemButton
                            selected={selectedIndex === index}
                            onFocus={(e) => handleListItemFocused(e, index)}
                            onClick={(e) => handleListItemClicked(e, entry)}
                            key={index}
                            ref={(el: HTMLDivElement | null) => {
                                itemRefs.current[index] = el;
                            }}
                        >
                            {entry.is_directory ? <Folder /> : <InsertDriveFile />}
                            <ListItemText primary={entry.name} sx={{ marginLeft: "5px" }} />
                        </ListItemButton>
                    )
                }
            </List>
        </Box >
    );
}

export default FileListViewer;
