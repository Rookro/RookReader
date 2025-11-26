import React from 'react';
import { Tab, Tabs, Box } from '@mui/material';
import GeneralSettings from './GeneralSettings/GeneralSettings';
import DeveloperSettings from './DeveloperSettings/DeveloperSettings';
import RenderingSettings from './RenderingSettings/RenderingSettings';
import TabPanel from '../TabPanel/TabPanel';

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
                sx={{ borderRight: 2, borderColor: 'divider' }}
            >
                <Tab label="General" />
                <Tab label="Developer" />
                <Tab label="Rendering" />
            </Tabs>
            <Box sx={{ padding: "12px", width: '100%', height: '100%', overflow: 'auto' }}>
                <TabPanel value={value} index={0}>
                    <GeneralSettings />
                </TabPanel>
                <TabPanel value={value} index={1}>
                    <DeveloperSettings />
                </TabPanel>
                <TabPanel value={value} index={2}>
                    <RenderingSettings />
                </TabPanel>
            </Box>
        </Box >
    );
}
