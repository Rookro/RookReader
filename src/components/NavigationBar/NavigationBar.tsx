import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { IconButton } from '@mui/material';
import { ArrowBack, ArrowForward, LooksOne, LooksTwo, Settings, SwitchLeft, SwitchRight } from '@mui/icons-material';
import { AppDispatch, useSelector } from "../../Store";
import { goBackContainerHistory, goForwardContainerHistory, setContainerFilePath, setExploreBasePath } from "../../reducers/FileReducer";
import { setDirection, setIsTwoPagedView } from "../../reducers/ViewReducer";
import "./NavigationBar.css";
import { dirname } from "@tauri-apps/api/path";
import { debug, error } from "@tauri-apps/plugin-log";
import { LazyStore } from "@tauri-apps/plugin-store";
import { Direction } from "../../types/DirectionType";

/**
 * ナビゲーションバーコンポーネント
 */
function NavigationBar() {
    const store = new LazyStore("rook-reader_settings.json");
    const { isTwoPagedView, direction } = useSelector(state => state.view);
    const { history, historyIndex } = useSelector(state => state.file.containerFile);
    const dispatch = useDispatch<AppDispatch>();

    const handlePathChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setContainerFilePath(e.target.value));
        dispatch(setExploreBasePath(await dirname(e.target.value)));
    }

    const handleSwitchTwoPagedClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        store.set("two-paged", !isTwoPagedView);
        dispatch(setIsTwoPagedView(!isTwoPagedView));
    }

    const handleSwitchDirectionClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        if (direction === "right") {
            store.set("direction", "left");
            dispatch(setDirection("left"));
        } else {
            store.set("direction", "right");
            dispatch(setDirection("right"));
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
            const direction = await store.get<Direction>("direction");
            const isTwoPaged = await store.get<boolean>("two-paged");
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
        <div className="navigation_bar">
            <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0}><ArrowBack /></IconButton>
            <IconButton onClick={handleForwardClicked} disabled={history.length - historyIndex <= 1}><ArrowForward /></IconButton>
            <input type="text" value={history[historyIndex]} onChange={handlePathChanged} onContextMenu={handleContextMenu}></input>
            <IconButton onClick={handleSwitchTwoPagedClicked}>
                {isTwoPagedView ? <LooksTwo /> : <LooksOne />}
            </IconButton>
            <IconButton onClick={handleSwitchDirectionClicked}>
                {direction === "right" ? <SwitchRight /> : <SwitchLeft />}
            </IconButton>
            <IconButton onClick={handleSettingsClicked}>
                <Settings />
            </IconButton>
        </div>
    );
}

export default NavigationBar;
