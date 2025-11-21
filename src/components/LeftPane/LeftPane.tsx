import React, { useState } from "react";
import { Stack, Tab, Tabs } from "@mui/material";
import { PhotoLibrary, ViewList } from "@mui/icons-material";
import FileListViewer from "../FileListViewer/FileListViewer";
import "./LeftPane.css";
import TabPanel from "../TabPanel/TabPanel";
import ImageEntriesViewer from "../ImageEntriesViewer/ImageEntriesViewer";

/**
 * 左ペイン
 */
function LeftPane() {
    const [value, setValue] = useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    return (
        <Stack className="left_pane" direction="row">
            <Tabs className="sidebar" orientation="vertical" value={value} onChange={handleChange} aria-label="sidebar-tabs"
                sx={{
                    borderRight: 1,
                    borderColor: 'divider',
                    minWidth: '40px',
                    width: '40px',
                }}
            >
                <Tab sx={{ minWidth: '40px' }} icon={<ViewList />} aria-label="library" />
                <Tab sx={{ minWidth: '40px' }} icon={<PhotoLibrary />} aria-label="image" />
            </Tabs>
            <TabPanel value={value} index={0}>
                <FileListViewer />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <ImageEntriesViewer />
            </TabPanel>
        </Stack>
    );
}

export default LeftPane;
