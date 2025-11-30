import React from 'react';
import { useTranslation } from "react-i18next";
import { Tab, Tabs, Box } from '@mui/material';
import GeneralSettings from './GeneralSettings/GeneralSettings';
import DeveloperSettings from './DeveloperSettings/DeveloperSettings';
import RenderingSettings from './RenderingSettings/RenderingSettings';
import TabPanel from '../TabPanel/TabPanel';
import AboutPage from './AboutPage/AboutPage';
import FileNavigatorSettings from './FileNavigatorSettings/FileNavigatorSettings';

/**
 * Settings page component.
 */
export default function SettingsView() {
    const { t } = useTranslation();
    const [value, setValue] = React.useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                width: '100%',
                height: '100%',
                padding: '0px 4px 4px 4px'
            }}
        >
            <Tabs
                orientation="vertical"
                variant="scrollable"
                value={value}
                onChange={handleChange}
                aria-label="setttings tabs"
                sx={{ borderRight: 2, borderColor: 'divider' }}
            >
                <Tab label={t('settings.general.tab-name')} />
                <Tab label={t('settings.rendering.tab-name')} />
                <Tab label={t('settings.developer.tab-name')} />
                <Tab label={t('settings.file-navigator.tab-name')} />
                <Tab label={t('settings.about.tab-name')} />
            </Tabs>
            <Box sx={{ padding: "12px", width: '100%', height: '100%', overflow: 'auto', bgcolor: (theme) => theme.palette.background.default }}>
                <TabPanel value={value} index={0}>
                    <GeneralSettings />
                </TabPanel>
                <TabPanel value={value} index={1}>
                    <RenderingSettings />
                </TabPanel>
                <TabPanel value={value} index={2}>
                    <DeveloperSettings />
                </TabPanel>
                <TabPanel value={value} index={3}>
                    <FileNavigatorSettings />
                </TabPanel>
                <TabPanel value={value} index={4}>
                    <AboutPage />
                </TabPanel>
            </Box>
        </Box >
    );
}
