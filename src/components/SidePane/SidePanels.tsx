import { JSX } from "react";
import { Box } from "@mui/material";
import TabPanel from "../TabPanel/TabPanel";

/**
 * Side panels component.
 */
export default function SidePanels(props: {
  tabs: { label: string; icon: JSX.Element; panel: JSX.Element }[];
  tabIndex: number;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        padding: "2px",
        bgcolor: (theme) => theme.palette.background.default,
      }}
    >
      {props.tabs.map((tab, index) => (
        <TabPanel
          value={props.tabIndex}
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
