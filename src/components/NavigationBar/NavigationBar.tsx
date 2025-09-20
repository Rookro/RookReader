import React from "react";
import { useDispatch } from "react-redux";
import { IconButton } from '@mui/material';
import { ArrowBack, ArrowForward, ArrowUpward, LooksOne, LooksTwo, SwitchLeft, SwitchRight } from '@mui/icons-material';
import { AppDispatch, useSelector } from "../../Store";
import { setContainerFile } from "../../reducers/FileReducer";
import { setDirection, setIsTwoPagedView } from "../../reducers/ViewReducer";
import "./NavigationBar.css";

/**
 * ナビゲーションバーコンポーネント
 */
function NavigationBar() {
    const { isTwoPagedView, direction } = useSelector(state => state.view);
    const { containerFile } = useSelector(state => state.file);
    const dispatch = useDispatch<AppDispatch>();

    const handlePathChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setContainerFile(e.target.value));
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

    return (
        <div className="navigation_bar">
            <IconButton><ArrowBack /></IconButton>
            <IconButton><ArrowForward /></IconButton>
            <IconButton><ArrowUpward /></IconButton>
            <input type="text" value={containerFile.path} onChange={handlePathChanged}></input>
            <IconButton onClick={handleSwitchTwoPagedClicked}>
                {isTwoPagedView ? <LooksTwo /> : <LooksOne />}
            </IconButton>
            <IconButton onClick={handleSwitchDirectionClicked}>
                {direction === "right" ? <SwitchRight /> : <SwitchLeft />}
            </IconButton>
        </div>
    );
}

export default NavigationBar;
