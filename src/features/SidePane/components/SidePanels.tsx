import { Box } from "@mui/material";
import TabPanel from "../../../components/ui/TabPanel/TabPanel";
import { SIDE_PANE_ATTRIBUTE } from "../sidePaneDom";
import type { SideTab } from "../types";

/**
 * Side panels component.
 */
export default function SidePanels(props: { tabs: SideTab[]; index: number; isHidden: boolean }) {
  return (
    <Box
      {...{ [SIDE_PANE_ATTRIBUTE]: "" }}
      inert={props.isHidden}
      sx={{
        width: "100%",
        height: "100%",
        padding: "2px",
        bgcolor: (theme) => theme.palette.background.default,
      }}
    >
      {props.tabs.map((tab, index) => (
        <TabPanel
          value={props.index}
          index={index}
          key={tab.label}
          sx={{ width: "100%", height: "100%" }}
        >
          {tab.panel}
        </TabPanel>
      ))}
    </Box>
  );
}
