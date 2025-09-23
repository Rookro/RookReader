import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { dirname, homeDir } from '@tauri-apps/api/path';
import { ArrowBack, ArrowForward, ArrowUpward, Home, Refresh, Search } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import { AppDispatch, useSelector } from '../../Store';
import { getEntriesInDir, setExploreBasePath, setSearchText } from '../../reducers/FileReducer';
import "./NavBar.css";

/**
 * ファイルリストのナビゲーションバーコンポーネント
 */
export default function NavBar() {
    const { basePath, searchText } = useSelector(state => state.file.explore);
    const dispatch = useDispatch<AppDispatch>();

    const initDirParh = async () => {
        const homeDirectory = await homeDir();
        dispatch(setSearchText(""));
        dispatch(getEntriesInDir(homeDirectory));
    }

    useEffect(() => {
        initDirParh();
    }, [])

    const handleCurrentDirChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setSearchText(""));
        dispatch(getEntriesInDir(e.target.value));
    }

    const handleHomeClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        initDirParh();
    }

    const handleParentClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        const parentDir = await dirname(basePath);
        dispatch(setSearchText(""));
        dispatch(setExploreBasePath(parentDir));
        dispatch(getEntriesInDir(parentDir));
    }

    const handleRefleshClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(getEntriesInDir(basePath));
    }

    const handleSearchTextChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setSearchText(e.target.value));
    }

    return (
        <Box className="file_nav_bar">
            <Box className='current_dir'>
                <input value={basePath} onChange={handleCurrentDirChanged}></input>
            </Box>
            <Box className="file_nav_buttons">
                <IconButton onClick={handleHomeClicked}><Home /></IconButton>
                <IconButton disabled><ArrowBack /></IconButton>
                <IconButton disabled><ArrowForward /></IconButton>
                <IconButton onClick={handleParentClicked}><ArrowUpward /></IconButton>
                <IconButton onClick={handleRefleshClicked}><Refresh /></IconButton>
            </Box>
            <Box className="file_search_bar">
                <Search />
                <input type='search' value={searchText} onChange={handleSearchTextChanged}></input>
            </Box>
        </Box >
    );
}
