import { Tab, Tabs } from "@mui/material";
import type React from "react";
import { type JSX, useCallback, useEffect } from "react";
import { useAppDispatch } from "../../../store/store";
import { updateSettings } from "../../Settings/slice";

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
        dispatch(
          updateSettings({
            key: "layout",
            value: { sidePane: { isHidden: !props.isHidden, tabIndex: props.index } },
          }),
        );
      }
    },
    [dispatch, props.index, props.isHidden],
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      dispatch(
        updateSettings({
          key: "layout",
          value: { sidePane: { isHidden: false, tabIndex: newValue } },
        }),
      );
    },
    [dispatch],
  );

  // Reset a persisted tabIndex that no longer maps to a tab. Done in an effect so
  // we don't dispatch during render (which re-fires every render until the async
  // settings round-trip resolves).
  useEffect(() => {
    if (props.tabs.length - 1 < props.index) {
      dispatch(
        updateSettings({
          key: "layout",
          value: { sidePane: { isHidden: props.isHidden, tabIndex: 0 } },
        }),
      );
    }
  }, [props.tabs.length, props.index, props.isHidden, dispatch]);

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
