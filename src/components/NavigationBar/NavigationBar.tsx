import React, { useEffect } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { IconButton, OutlinedInput, Stack } from '@mui/material';
import { ArrowBack, ArrowForward, LooksOne, LooksTwo, Settings, SwitchLeft, SwitchRight } from '@mui/icons-material';
import { debug, error } from "@tauri-apps/plugin-log";
import { Direction } from "../../types/DirectionType";
import { settingsStore } from "../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../Store";
import { goBackContainerHistory, goForwardContainerHistory, setContainerFilePath } from "../../reducers/FileReducer";
import { setDirection, setIsTwoPagedView } from "../../reducers/ViewReducer";

/**
 * Navigation bar component.
 */
export default function NavigationBar() {
    const { isTwoPagedView, direction } = useAppSelector(state => state.view);
    const { history, historyIndex } = useAppSelector(state => state.file.containerFile);
    const dispatch = useAppDispatch();

    const handlePathChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setContainerFilePath(e.target.value));
    }

    const handleSwitchTwoPagedClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        settingsStore.set("two-paged", !isTwoPagedView);
        dispatch(setIsTwoPagedView(!isTwoPagedView));
    }

    const handleSwitchDirectionClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        if (direction === "rtl") {
            settingsStore.set("direction", "ltr");
            dispatch(setDirection("ltr"));
        } else {
            settingsStore.set("direction", "rtl");
            dispatch(setDirection("rtl"));
        }
    }

    const handleBackClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(goBackContainerHistory());
    }

    const handleForwardClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(goForwardContainerHistory());
    }

    const handleSettingsClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        debug("handleSettingsClicked");
        try {
            const settingsWindow = new WebviewWindow('settings', {
                url: '/#/settings',
                title: 'Settings',
                parent: "main",
                width: 600,
                height: 400,
                resizable: true,
                center: true,
            });

            return settingsWindow;
        } catch (ex) {
            error(`Failed to open settings window. ${JSON.stringify(ex)}`);
        }
    }

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
    }

    useEffect(() => {
        const initViewSettings = async () => {
            const direction = await settingsStore.get<Direction>("direction");
            const isTwoPaged = await settingsStore.get<boolean>("two-paged");
            if (direction) {
                dispatch(setDirection(direction));
            }
            if (isTwoPaged !== undefined) {
                dispatch(setIsTwoPagedView(isTwoPaged));
            }
        };
        initViewSettings();
    }, [dispatch])

    return (
        <Stack
            direction="row"
            sx={{
                height: '30px',
                margin: '4px',
            }}
        >
            <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0}><ArrowBack /></IconButton>
            <IconButton onClick={handleForwardClicked} disabled={history.length - historyIndex <= 1}><ArrowForward /></IconButton>
            <OutlinedInput
                value={history[historyIndex] ?? ''} onChange={handlePathChanged} onContextMenu={handleContextMenu}
                size="small" fullWidth
                sx={{
                    bgcolor: (theme) => theme.palette.background.default,
                    '& .MuiOutlinedInput-input': {
                        padding: '4px 8px',
                    },
                }} />
            <IconButton onClick={handleSwitchTwoPagedClicked}>
                {isTwoPagedView ? <LooksTwo /> : <LooksOne />}
            </IconButton>
            <IconButton onClick={handleSwitchDirectionClicked}>
                {direction === "rtl" ? <SwitchRight /> : <SwitchLeft />}
            </IconButton>
            <IconButton onClick={handleSettingsClicked}>
                <Settings />
            </IconButton>
        </Stack >
    );
}
