import React, { useState } from "react";
import { Stack, Tab, Tabs } from "@mui/material";
import { PhotoLibrary, ViewList } from "@mui/icons-material";
import FileListViewer from "../FileListViewer/FileListViewer";
import TabPanel from "../TabPanel/TabPanel";
import ImageEntriesViewer from "../ImageEntriesViewer/ImageEntriesViewer";

/**
 * 左ペイン
 */
export default function LeftPane() {
    const [value, setValue] = useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    return (
        <Stack
            direction="row"
            sx={{
                height: '100%',
                backgroundColor: 'background.paper',
            }}
        >
            <Tabs
                orientation="vertical"
                value={value}
                onChange={handleChange}
                aria-label="sidebar-tabs"
                sx={{
                    borderRight: 2,
                    borderColor: 'divider',
                    minWidth: '40px',
                    width: '40px',
                    '& .MuiTab-root': {
                        minWidth: '40px',
                    }
                }}
            >
                <Tab icon={<ViewList />} aria-label="library" />
                <Tab icon={<PhotoLibrary />} aria-label="image" />
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
