import React, { JSX, useCallback } from "react";
import { Tab, Tabs } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../Store";
import { setLeftSideTabIndex } from "../../reducers/SidePaneReducer";

/**
 * Side tabs component.
 */
export default function SideTabs(props: {
  tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[];
}) {
  const { tabIndex } = useAppSelector((state) => state.sidePane.left);
  const dispatch = useAppDispatch();

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      dispatch(setLeftSideTabIndex(newValue));
    },
    [dispatch],
  );

  if (props.tabs.length - 1 < tabIndex) {
    dispatch(setLeftSideTabIndex(0));
  }

  return (
    <Tabs
      orientation="vertical"
      value={tabIndex}
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
      {props.tabs.map((tab, _index) => (
        <Tab key={tab.label} icon={tab.icon} aria-label={tab.label} />
      ))}
    </Tabs>
  );
}
