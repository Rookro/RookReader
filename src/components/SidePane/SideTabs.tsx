import React, { JSX, useCallback } from "react";
import { Tab, Tabs } from "@mui/material";
import { useAppDispatch } from "../../Store";
import { setLeftSideTabIndex, setIsLeftSidePanelsHidden } from "../../reducers/SidePaneReducer";

/**
 * Side tabs component.
 */
export default function SideTabs(props: {
  tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[];
  tabIndex: number;
  isHidden: boolean;
}) {
  const dispatch = useAppDispatch();

  const handleTabClick = useCallback(
    (_event: React.MouseEvent, index: number) => {
      if (props.tabIndex === index) {
        dispatch(setIsLeftSidePanelsHidden(!props.isHidden));
      }
    },
    [dispatch, props.tabIndex, props.isHidden],
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      dispatch(setIsLeftSidePanelsHidden(false));
      dispatch(setLeftSideTabIndex(newValue));
    },
    [dispatch],
  );

  if (props.tabs.length - 1 < props.tabIndex) {
    dispatch(setLeftSideTabIndex(0));
  }

  return (
    <Tabs
      orientation="vertical"
      value={props.tabIndex}
      onChange={handleChange}
      aria-label="sidebar-tabs"
      sx={{
        borderColor: "divider",
        minWidth: "40px",
        width: "40px",
        "& .MuiTab-root": {
          minWidth: "40px",
        },
      }}
    >
      {props.tabs.map((tab, index) => (
        <Tab
          key={tab.label}
          icon={tab.icon}
          aria-label={tab.label}
          onClick={(e) => handleTabClick(e, index)}
        />
      ))}
    </Tabs>
  );
}
