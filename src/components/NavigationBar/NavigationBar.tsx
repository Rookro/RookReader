import React from "react";
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

/**
 * ナビゲーションバーコンポーネント
 */
function NavigationBar() {
    const { isTwoPagedView, direction } = useSelector(state => state.view);
    const { history, historyIndex } = useSelector(state => state.file.containerFile);
    const dispatch = useDispatch<AppDispatch>();

    const handlePathChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setContainerFilePath(e.target.value));
        dispatch(setExploreBasePath(await dirname(e.target.value)));
    }

    const handleSwitchTwoPagedClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch(setIsTwoPagedView(!isTwoPagedView));
    }

    const handleSwitchDirectionClicked = (_e: React.MouseEvent<HTMLButtonElement>) => {
        if (direction === "right") {
            dispatch(setDirection("left"));
        } else {
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

    return (
        <div className="navigation_bar">
            <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0}><ArrowBack /></IconButton>
            <IconButton onClick={handleForwardClicked} disabled={history.length - historyIndex <= 1}><ArrowForward /></IconButton>
            <input type="text" value={history[historyIndex]} onChange={handlePathChanged}></input>
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
