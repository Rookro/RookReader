import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { dirname, homeDir } from '@tauri-apps/api/path';
import { ArrowBack, ArrowForward, ArrowUpward, Home, Refresh, Search } from '@mui/icons-material';
import { Box, IconButton, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { AppDispatch, useSelector } from '../../Store';
import { getEntriesInDir, goBackExplorerHistory, goForwardExplorerHistory, setExploreBasePath, setSearchText, setSortOrder } from '../../reducers/FileReducer';
import { SortOrder } from '../../types/SortOrderType';
import { settingsStore } from '../../settings/SettingsStore';
import "./NavBar.css";

/**
 * ファイルリストのナビゲーションバーコンポーネント
 */
export default function NavBar() {
    const { history, historyIndex, searchText, sortOrder } = useSelector(state => state.file.explorer);
    const dispatch = useDispatch<AppDispatch>();

    const initDirParh = async () => {
        const homeDirectory = await homeDir();
        dispatch(setSearchText(""));
        dispatch(setExploreBasePath(homeDirectory));
    }

    useEffect(() => {
        initDirParh();
    }, [])

    useEffect(() => {
        const initViewSettings = async () => {
            const sortOrder = await settingsStore.get<SortOrder>("sort-order");
            if (sortOrder) {
                dispatch(setSortOrder(sortOrder));
            }
        };
        initViewSettings();
    }, [dispatch])

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

    const handleSortOrderChanged = (event: SelectChangeEvent) => {
        settingsStore.set("sort-order", event.target.value as SortOrder);
        dispatch(setSortOrder(event.target.value as SortOrder));
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
                <Select size="small" value={sortOrder} sx={{ minWidth: "100px" }} onChange={handleSortOrderChanged}>
                    <MenuItem value={"NAME_ASC"}>Name↑</MenuItem>
                    <MenuItem value={"NAME_DESC"}>Name↓</MenuItem>
                    <MenuItem value={"DATE_ASC"}>Date↑</MenuItem>
                    <MenuItem value={"DATE_DESC"}>Date↓</MenuItem>
                </Select>
            </Box>
            <Box className="file_search_bar">
                <Search />
                <input type='search' value={searchText} onChange={handleSearchTextChanged} onContextMenu={handleContextMenu}></input>
            </Box>
        </Box >
    );
}
