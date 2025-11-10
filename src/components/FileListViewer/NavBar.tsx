import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { dirname, homeDir } from '@tauri-apps/api/path';
import { ArrowBack, ArrowForward, ArrowUpward, Home, Refresh, Search } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import { AppDispatch, useSelector } from '../../Store';
import { getEntriesInDir, goBackExplorerHistory, goForwardExplorerHistory, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import "./NavBar.css";

/**
 * ファイルリストのナビゲーションバーコンポーネント
 */
export default function NavBar() {
    const { history, historyIndex, searchText } = useSelector(state => state.file.explorer);
    const dispatch = useDispatch<AppDispatch>();

    const initDirParh = async () => {
        const homeDirectory = await homeDir();
        dispatch(setSearchText(""));
        dispatch(setExploreBasePath(homeDirectory));
    }

    useEffect(() => {
        initDirParh();
    }, [])

    const handleCurrentDirChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setSearchText(""));
        dispatch(setExploreBasePath(e.target.value));
    }

    const handleHomeClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        initDirParh();
    }

    const handleParentClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(setSearchText(""));
        dispatch(setExploreBasePath(await dirname(history[historyIndex])));
    }

    const handleRefleshClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(getEntriesInDir(history[historyIndex]));
    }

    const handleSearchTextChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setSearchText(e.target.value));
    }

    const handleBackClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(goBackExplorerHistory());
    }

    const handleForwardClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(goForwardExplorerHistory());
    }

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
    }

    return (
        <Box className="file_nav_bar">
            <Box className='current_dir'>
                <input value={history[historyIndex] ?? ""} onChange={handleCurrentDirChanged} onContextMenu={handleContextMenu}></input>
            </Box>
            <Box className="file_nav_buttons">
                <IconButton onClick={handleHomeClicked}><Home /></IconButton>
                <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0}><ArrowBack /></IconButton>
                <IconButton onClick={handleForwardClicked} disabled={history.length - historyIndex <= 1}><ArrowForward /></IconButton>
                <IconButton onClick={handleParentClicked}><ArrowUpward /></IconButton>
                <IconButton onClick={handleRefleshClicked}><Refresh /></IconButton>
            </Box>
            <Box className="file_search_bar">
                <Search />
                <input type='search' value={searchText} onChange={handleSearchTextChanged} onContextMenu={handleContextMenu}></input>
            </Box>
        </Box >
    );
}
