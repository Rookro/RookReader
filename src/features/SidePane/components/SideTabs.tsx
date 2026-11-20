import { Tab, Tabs, Tooltip } from "@mui/material";
import type React from "react";
import { useCallback, useEffect } from "react";
import { releaseMouseFocus } from "../../../utils/releaseMouseFocus";
import { useApplySidePane } from "../hooks/useApplySidePane";
import { useSidePaneFocus } from "../SidePaneFocusContext";
import { isInSidePane, SIDE_PANE_ATTRIBUTE } from "../sidePaneDom";
import type { SideTab } from "../types";

/**
 * Side tabs component.
 */
export default function SideTabs(props: { tabs: SideTab[]; index: number; isHidden: boolean }) {
  const applySidePane = useApplySidePane();
  const { returnToReader } = useSidePaneFocus();

  const handleTabClick = useCallback(
    (event: React.MouseEvent, index: number) => {
      releaseMouseFocus(event);
      if (props.index === index) {
        applySidePane({ isHidden: !props.isHidden, tabIndex: props.index });
        if (!props.isHidden && isInSidePane(document.activeElement)) {
          returnToReader();
        }
      }
    },
    [applySidePane, returnToReader, props.index, props.isHidden],
  );

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      applySidePane({ isHidden: false, tabIndex: newValue });
    },
    [applySidePane],
  );

  // Reset a persisted tabIndex that no longer maps to a tab. Done in an effect so
  // we don't dispatch during render.
  useEffect(() => {
    if (props.tabs.length - 1 < props.index) {
      applySidePane({ isHidden: props.isHidden, tabIndex: 0 });
    }
  }, [props.tabs.length, props.index, props.isHidden, applySidePane]);

  return (
    <Tabs
      {...{ [SIDE_PANE_ATTRIBUTE]: "" }}
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
        <Tooltip key={tab.label} title={tab.label} placement="right">
          <Tab icon={tab.icon} aria-label={tab.label} onClick={(e) => handleTabClick(e, index)} />
        </Tooltip>
      ))}
    </Tabs>
  );
}
