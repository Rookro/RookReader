import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { dirname, homeDir } from '@tauri-apps/api/path';
import { ArrowBack, ArrowForward, ArrowUpward, Home, Refresh, Search, } from '@mui/icons-material';
import { Box, IconButton, InputAdornment, MenuItem, OutlinedInput, Select, SelectChangeEvent, Stack } from '@mui/material';
import { AppDispatch, useSelector } from '../../Store';
import { getEntriesInDir, goBackExplorerHistory, goForwardExplorerHistory, setExploreBasePath, setSearchText, setSortOrder } from '../../reducers/FileReducer';
import { SortOrder } from '../../types/SortOrderType';
import { settingsStore } from '../../settings/SettingsStore';

/**
 * Navigation bar component for File list viewer component.
 */
export default function NavBar() {
    const { history, historyIndex, searchText, sortOrder } = useSelector(state => state.file.explorer);
    const dispatch = useDispatch<AppDispatch>();

    const [width, setWidth] = React.useState(0);

    const navButtonsRef = useRef<HTMLElement>(null);

    const setDirParh = async (dirPath: string | undefined = undefined) => {
        if (!dirPath) {
            dirPath = await homeDir();
        }
        dispatch(setSearchText(""));
        dispatch(setExploreBasePath(dirPath));
    }

    useEffect(() => {
        const dirPath = historyIndex === -1 ? undefined : history[historyIndex]
        setDirParh(dirPath);

        const element = navButtonsRef.current
        if (!element) {
            return;
        }
        const observer = new ResizeObserver(() => {
            setWidth(element?.offsetWidth ?? 0);
        })
        observer.observe(element)

        return () => {
            if (element) {
                observer.unobserve(element)
            }
        }
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
        setDirParh();
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
        <Stack >
            <OutlinedInput
                value={history[historyIndex] ?? ""}
                onChange={handleCurrentDirChanged}
                onContextMenu={handleContextMenu}
                size="small"
                fullWidth
                sx={{
                    '& .MuiOutlinedInput-input': {
                        padding: '4px 8px',
                    },
                }} />
            <Box
                ref={navButtonsRef}
                sx={{
                    '& .MuiIconButton-root': {
                        color: (theme) => theme.palette.primary.main,
                    },
                    '& .MuiIconButton-root.Mui-disabled': {
                        color: (theme) => theme.palette.action.disabled,
                    },
                }}
            >
                <IconButton onClick={handleHomeClicked}><Home /></IconButton>
                <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0}><ArrowBack /></IconButton>
                <IconButton onClick={handleForwardClicked} disabled={history.length - historyIndex <= 1}><ArrowForward /></IconButton>
                <IconButton onClick={handleParentClicked}><ArrowUpward /></IconButton>
                <IconButton onClick={handleRefleshClicked}><Refresh /></IconButton>
                {width >= 310 ?
                    <Select
                        size="small"
                        value={sortOrder}
                        sx={{ minWidth: "100px" }}
                        onChange={handleSortOrderChanged}
                    >
                        <MenuItem value={"NAME_ASC"}>Name↑</MenuItem>
                        <MenuItem value={"NAME_DESC"}>Name↓</MenuItem>
                        <MenuItem value={"DATE_ASC"}>Date↑</MenuItem>
                        <MenuItem value={"DATE_DESC"}>Date↓</MenuItem>
                    </Select>
                    : <></>}
            </Box>
            <OutlinedInput
                type='search'
                value={searchText}
                onChange={handleSearchTextChanged}
                onContextMenu={handleContextMenu}
                size="small" fullWidth
                sx={{
                    paddingLeft: '4px',
                    '& .MuiOutlinedInput-input': {
                        padding: '4px 8px 4px 4px',
                    },
                }}
                startAdornment={
                    <InputAdornment position="start" sx={{ marginRight: '0px' }}>
                        <Search />
                    </InputAdornment>
                }
            />
        </Stack >
    );
}
