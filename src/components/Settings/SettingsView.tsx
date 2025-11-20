import React from 'react';
import { Tab, Tabs, Box } from '@mui/material';
import GeneralSettings from './GeneralSettings/GeneralSettings';
import DeveloperSettings from './DeveloperSettings/DeveloperSettings';
import TabPanel from '../TabPanel/TabPanel';
import './SettingsView.css';

/**
 * 設定画面コンポーネント
 */
export default function SettingsView() {
    const [value, setValue] = React.useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    return (
        <Box
            className="settings_view"
            sx={{ flexGrow: 1, bgcolor: 'background.paper' }}
        >
            <Tabs
                orientation="vertical"
                variant="scrollable"
                value={value}
                onChange={handleChange}
                aria-label="setttings tabs"
                sx={{ borderRight: 2, borderColor: 'divider' }}
            >
                <Tab label="General" />
                <Tab label="Developer" />
            </Tabs>
            <Box sx={{ padding: "16px" }}>
                <TabPanel value={value} index={0}>
                    <GeneralSettings />
                </TabPanel>
                <TabPanel value={value} index={1}>
                    <DeveloperSettings />
                </TabPanel>
            </Box>
        </Box >
    );
}
