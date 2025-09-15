import React from "react";
import { useDispatch } from "react-redux";
import { IconButton } from '@mui/material';
import { ArrowBack, ArrowForward, ArrowUpward, LooksOne, LooksTwo, SwitchLeft, SwitchRight } from '@mui/icons-material';
import { AppDispatch, useSelector } from "../../Store";
import { getEntriesInZip, setContainerPath } from "../../reducers/FileReducer";
import { setDirection, setIsTwoPagedView } from "../../reducers/ViewReducer";
import "./NavigationBar.css";

/**
 * ナビゲーションバーコンポーネント
 */
function NavigationBar() {
    const { isTwoPagedView, direction } = useSelector(state => state.view);
    const { containerPath } = useSelector(state => state.file);
    const dispatch = useDispatch<AppDispatch>();

    const handlePathChanged = (e: React.ChangeEvent<HTMLInputElement>) => {

        dispatch(setContainerPath(e.target.value));
        dispatch(getEntriesInZip(e.target.value));
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
            <input type="text" value={containerPath} onChange={handlePathChanged}></input>
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
