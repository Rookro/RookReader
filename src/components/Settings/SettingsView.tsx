import React, { JSX } from 'react';
import { useTranslation } from "react-i18next";
import { Tab, Tabs, Box } from '@mui/material';
import GeneralSettings from './GeneralSettings/GeneralSettings';
import DeveloperSettings from './DeveloperSettings/DeveloperSettings';
import RenderingSettings from './RenderingSettings/RenderingSettings';
import TabPanel from '../TabPanel/TabPanel';
import AboutPage from './AboutPage/AboutPage';
import FileNavigatorSettings from './FileNavigatorSettings/FileNavigatorSettings';
import PageSettings from './PageSettings/PageSettings';
import HistorySettings from './HistorySettings/HistorySettings';

/**
 * Settings page component.
 */
export default function SettingsView() {
    const { t } = useTranslation();
    const [value, setValue] = React.useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    const tabs: { label: string, panel: JSX.Element }[] = [
        { label: t('settings.general.tab-name'), panel: <GeneralSettings /> },
        { label: t('settings.page.tab-name'), panel: <PageSettings /> },
        { label: t('settings.file-navigator.tab-name'), panel: <FileNavigatorSettings /> },
        { label: t('settings.history.tab-name'), panel: <HistorySettings /> },
        { label: t('settings.rendering.tab-name'), panel: <RenderingSettings /> },
        { label: t('settings.developer.tab-name'), panel: <DeveloperSettings /> },
        { label: t('settings.about.tab-name'), panel: <AboutPage /> }
    ];

    return (
        <Box
            sx={{
                display: 'flex',
                width: '100%',
                height: '100%',
            }}
        >
            <Tabs
                orientation="vertical"
                variant="scrollable"
                value={value}
                onChange={handleChange}
                aria-label="setttings tabs"
                sx={{ borderRight: 2, borderColor: 'divider', width: '150px' }}
            >
                {tabs.map((tab, index) => (
                    <Tab key={index} label={tab.label} />
                ))}
            </Tabs>
            <Box sx={{ padding: "12px", width: '100%', height: '100%', overflow: 'auto', bgcolor: (theme) => theme.palette.background.default }}>
                {tabs.map((tab, index) => (
                    <TabPanel value={value} index={index} key={index} sx={{ minWidth: '650px' }}>
                        {tab.panel}
                    </TabPanel>
                ))}
            </Box>
        </Box >
    );
}
