import React, { JSX, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Stack, Tab, Tabs } from "@mui/material";
import { History, PhotoLibrary, ViewList } from "@mui/icons-material";
import TabPanel from "../TabPanel/TabPanel";
import HistoryViewer from "../HistoryViewer/HistoryViewer";
import { useAppSelector } from "../../Store";

const FileNavigator = lazy(() => import("../FileNavigator/FileNavigator"));
const ImageEntriesViewer = lazy(() => import("../ImageEntriesViewer/ImageEntriesViewer"));

/**
 * Left pane component.
 */
export default function LeftPane() {
    const [tabIndex, setTabIndex] = useState(0);
    const { isHistoryEnabled } = useAppSelector(state => state.history);

    const handleChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    }, []);

    const tabs: { label: string, icon: JSX.Element, panel: JSX.Element }[] = useMemo(() => {
        const tabs = [
            { label: "file-navigator", icon: <ViewList />, panel: <FileNavigator /> },
            { label: "image-entries", icon: <PhotoLibrary />, panel: <ImageEntriesViewer /> },
        ]

        if (isHistoryEnabled) {
            tabs.push({ label: "history", icon: <History />, panel: <HistoryViewer /> });
        }
        return tabs;
    }, [isHistoryEnabled]);

    useEffect(() => {
        if (tabs.length - 1 < tabIndex) {
            setTabIndex(0);
        }
    }, [tabs]);

    return (
        <Stack
            direction="row"
            sx={{
                height: '100%',
            }}
        >
            <Tabs
                orientation="vertical"
                value={tabIndex}
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
                {tabs.map((tab) => (
                    <Tab key={tab.label} icon={tab.icon} aria-label={tab.label} />
                ))}
            </Tabs>
            <Box sx={{ width: '100%', height: '100%', padding: '2px', bgcolor: (theme) => theme.palette.background.default }}>
                {tabs.map((tab, index) => (
                    <TabPanel value={tabIndex} index={index} key={tab.label} sx={{ width: '100%', height: '100%' }}>
                        {tab.panel}
                    </TabPanel>
                ))}
            </Box>
        </Stack>
    );
}
