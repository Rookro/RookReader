import React, { lazy, useState } from "react";
import { Box, Stack, Tab, Tabs } from "@mui/material";
import { PhotoLibrary, ViewList } from "@mui/icons-material";
import TabPanel from "../TabPanel/TabPanel";

const FileListViewer = lazy(() => import("../FileListViewer/FileListViewer"));
const ImageEntriesViewer = lazy(() => import("../ImageEntriesViewer/ImageEntriesViewer"));

/**
 * Left pane component.
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
            }}
        >
            <Tabs
                orientation="vertical"
                value={value}
                onChange={handleChange}
                aria-label="sidebar-tabs"
                sx={{
                    borderColor: 'divider',
                    minWidth: '40px',
                    width: '40px',
                    '& .MuiTab-root': {
                        minWidth: '40px',
                    },
                }}
            >
                <Tab icon={<ViewList />} aria-label="library" />
                <Tab icon={<PhotoLibrary />} aria-label="image" />
            </Tabs>
            <Box sx={{ width: '100%', height: '100%', padding: '2px', bgcolor: (theme) => theme.palette.background.default }}>
                <TabPanel value={value} index={0} sx={{ width: '100%', height: '100%' }}>
                    <FileListViewer />
                </TabPanel>
                <TabPanel value={value} index={1} sx={{ width: '100%', height: '100%' }}>
                    <ImageEntriesViewer />
                </TabPanel>
            </Box>
        </Stack>
    );
}
