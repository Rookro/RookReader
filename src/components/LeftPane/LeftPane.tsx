import React, { JSX, lazy, useState } from "react";
import { Box, Stack, Tab, Tabs } from "@mui/material";
import { History, PhotoLibrary, ViewList } from "@mui/icons-material";
import TabPanel from "../TabPanel/TabPanel";
import HistoryViewer from "../HistoryViewer/HistoryViewer";

const FileNavigator = lazy(() => import("../FileNavigator/FileNavigator"));
const ImageEntriesViewer = lazy(() => import("../ImageEntriesViewer/ImageEntriesViewer"));

/**
 * Left pane component.
 */
export default function LeftPane() {
    const [value, setValue] = useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    const tabs: { label: string, icon: JSX.Element, panel: JSX.Element }[] = [
        { label: "file-navigator", icon: <ViewList />, panel: <FileNavigator /> },
        { label: "image-entries", icon: <PhotoLibrary />, panel: <ImageEntriesViewer /> },
        { label: "history", icon: <History />, panel: <HistoryViewer /> },
    ];

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
                {tabs.map((tab, index) => (
                    <Tab key={index} icon={tab.icon} aria-label={tab.label} />
                ))}
            </Tabs>
            <Box sx={{ width: '100%', height: '100%', padding: '2px', bgcolor: (theme) => theme.palette.background.default }}>
                {tabs.map((tab, index) => (
                    <TabPanel value={value} index={index} key={index} sx={{ width: '100%', height: '100%' }}>
                        {tab.panel}
                    </TabPanel>
                ))}
            </Box>
        </Stack>
    );
}
