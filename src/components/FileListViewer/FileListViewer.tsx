import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { join } from '@tauri-apps/api/path';
import { useSelector, AppDispatch } from '../../Store';
import { getEntriesInDir, setContainerFilePath, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import { DirEntry } from '../../types/DirEntry';
import NavBar from './NavBar';
import "./FileListViewer.css";
import { Folder, InsertDriveFile } from '@mui/icons-material';

/** 
 * ファイルリスト表示コンポネント 
 */
function FileListViewer() {
    const { history, historyIndex, entries, searchText } = useSelector(state => state.file.explorer);
    const dispatch = useDispatch<AppDispatch>();

    const [selectedIndex, setSelectedIndex] = useState(-1);

    useEffect(() => {
        dispatch(getEntriesInDir(history[historyIndex]));
    }, [history, historyIndex, dispatch]);

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
                {entries
                    .filter((entry) => searchText ? entry.name.toLowerCase().includes(searchText.toLowerCase()) : true)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((entry, index) =>
                        <ListItemButton
                            selected={selectedIndex === index}
                            onFocus={(e) => handleListItemFocused(e, index)}
                            onClick={(e) => handleListItemClicked(e, entry)}
                            key={index}
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
