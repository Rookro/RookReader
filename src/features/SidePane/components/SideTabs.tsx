import { Tab, Tabs } from "@mui/material";
import type React from "react";
import { type JSX, useCallback } from "react";
import { useAppDispatch } from "../../../store/store";
import { setIsLeftSidePanelsHidden, setLeftSideTabIndex } from "../slice";

/**
 * Side tabs component.
 */
export default function SideTabs(props: {
  tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[];
  index: number;
  isHidden: boolean;
}) {
  const dispatch = useAppDispatch();

  const handleTabClick = useCallback(
    (_event: React.MouseEvent, index: number) => {
      if (props.index === index) {
        dispatch(setIsLeftSidePanelsHidden(!props.isHidden));
      }
    },
    [dispatch, props.index, props.isHidden],
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      dispatch(setIsLeftSidePanelsHidden(false));
      dispatch(setLeftSideTabIndex(newValue));
    },
    [dispatch],
  );

  if (props.tabs.length - 1 < props.index) {
    dispatch(setLeftSideTabIndex(0));
  }

  return (
    <Tabs
      orientation="vertical"
      value={props.index}
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
