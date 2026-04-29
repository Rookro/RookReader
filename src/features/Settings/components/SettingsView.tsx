import { Box, Tab, Tabs } from "@mui/material";
import React, { type JSX, useCallback } from "react";
import { useTranslation } from "react-i18next";
import TabPanel from "../../../components/ui/TabPanel/TabPanel";
import AboutPage from "./AboutPage/AboutPage";
import BookshelfSettings from "./BookshelfSettings/BookshelfSettings";
import DeveloperSettings from "./DeveloperSettings/DeveloperSettings";
import FileNavigatorSettings from "./FileNavigatorSettings/FileNavigatorSettings";
import GeneralSettings from "./GeneralSettings/GeneralSettings";
import HistorySettings from "./HistorySettings/HistorySettings";
import NovelReaderSettings from "./NovelReaderSettings/NovelReaderSettings";
import PageSettings from "./PageSettings/PageSettings";
import RenderingSettings from "./RenderingSettings/RenderingSettings";
import StartupSettings from "./StartupSettings/StartupSettings";

/**
 * Settings page component.
 */
export default function SettingsView() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(0);

  const handleChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  }, []);

  const tabs: { label: string; panel: JSX.Element }[] = [
    { label: t("settings.general.tab-name"), panel: <GeneralSettings /> },
    { label: t("settings.startup.tab-name"), panel: <StartupSettings /> },
    { label: t("settings.bookshelf.tab-name"), panel: <BookshelfSettings /> },
    { label: t("settings.page.tab-name"), panel: <PageSettings /> },
    { label: t("settings.file-navigator.tab-name"), panel: <FileNavigatorSettings /> },
    { label: t("settings.history.tab-name"), panel: <HistorySettings /> },
    { label: t("settings.rendering.tab-name"), panel: <RenderingSettings /> },
    { label: t("settings.novel-reader.tab-name"), panel: <NovelReaderSettings /> },
    { label: t("settings.developer.tab-name"), panel: <DeveloperSettings /> },
    { label: t("settings.about.tab-name"), panel: <AboutPage /> },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        height: "100%",
      }}
      data-testid="settings-container"
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={value}
        onChange={handleChange}
        aria-label="setttings tabs"
        sx={{ borderRight: 2, borderColor: "divider", width: "150px" }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.label} label={tab.label} />
        ))}
      </Tabs>
      <Box
        sx={{
          padding: "12px",
          width: "100%",
          height: "100%",
          overflow: "auto",
          bgcolor: (theme) => theme.palette.background.default,
        }}
      >
        {tabs.map((tab, index) => (
          <TabPanel value={value} index={index} key={tab.label} sx={{ minWidth: "650px" }}>
            {tab.panel}
          </TabPanel>
        ))}
      </Box>
    </Box>
  );
}
