import React from 'react';
import { Tab, Tabs, Typography, Box } from '@mui/material';
import GeneralSettings from './GeneralSettings/GeneralSettings';
import DeveloperSettings from './DeveloperSettings/DeveloperSettings';
import './SettingsView.css';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    <Typography>{children}</Typography>
                </Box>
            )}
        </div>
    );
}

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
            <TabPanel value={value} index={0}>
                <GeneralSettings />
            </TabPanel>
            <TabPanel value={value} index={1}>
                <DeveloperSettings />
            </TabPanel>
        </Box>
    );
}
