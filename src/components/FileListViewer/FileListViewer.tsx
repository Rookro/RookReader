import * as React from 'react';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { join } from '@tauri-apps/api/path';
import { useSelector, AppDispatch } from '../../Store';
import { getEntriesInDir, setContainerFile } from '../../reducers/FileReducer';
import { DirEntry } from '../../types/DirEntry';
import NavBar from './NavBar';
import "./FileListViewer.css";

/** 
 * ファイルリスト表示コンポネント 
 */
function FileListViewer() {
    const { basePath, entries } = useSelector(state => state.file.explore);
    const dispatch = useDispatch<AppDispatch>();

    const [selectedIndex, setSelectedIndex] = React.useState(0);

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
        const path = await join(basePath, entry.name);
        if (entry.is_directory) {
            dispatch(getEntriesInDir(path));
        } else {
            dispatch(setContainerFile(path));
        }
    };
    return (
        <Box sx={{ width: '100%', display: 'grid', alignContent: 'start' }}>
            <NavBar />
            <List className="file_list" component="nav" dense={true}>
                {entries.map((entry, index) =>
                    <ListItemButton
                        selected={selectedIndex === index}
                        onFocus={(e) => handleListItemFocused(e, index)}
                        onClick={(e) => handleListItemClicked(e, entry)}
                        key={index}
                    >
                        <ListItemText primary={entry.name} />
                    </ListItemButton>)
                }
            </List>
        </Box>
    );
}

export default FileListViewer;
