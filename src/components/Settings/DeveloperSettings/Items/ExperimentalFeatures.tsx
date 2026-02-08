import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuBookOutlined, ScienceOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText, Switch } from "@mui/material";
import { settingsStore } from "../../../../settings/SettingsStore";
import { ExperimentalFeaturesSettings } from "../../../../types/Settings";

/**
 * Experimental features settings component.
 */
export default function ExperimentalFeatures() {
  const { t } = useTranslation();
  const [isEpubNovelReaderEnabled, setIsEpubNovelReaderEnabled] = useState(false);

  useEffect(() => {
    const init = async () => {
      const experimentalFeatures = (await settingsStore.get<ExperimentalFeaturesSettings>(
        "experimental-features",
      )) ?? {
        "enable-epub-novel-reader": false,
      };
      setIsEpubNovelReaderEnabled(experimentalFeatures["enable-epub-novel-reader"]);
    };
    init();
  }, []);

  const handleIsEpubNovelReaderEnabledChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsEpubNovelReaderEnabled(e.target.checked);
      await settingsStore.set("experimental-features", {
        "enable-epub-novel-reader": e.target.checked,
      });
    },
    [],
  );

  return (
    <>
      <ListItem>
        <ListItemIcon>
          <ScienceOutlined />
        </ListItemIcon>
        <ListItemText
          primary={t("settings.developer.experimental-features.title")}
          secondary={t("settings.developer.experimental-features.description")}
        />
      </ListItem>
      <ListItem
        secondaryAction={
          <Switch
            edge="end"
            checked={isEpubNovelReaderEnabled}
            onChange={handleIsEpubNovelReaderEnabledChanged}
          />
        }
      >
        <ListItemIcon>
          <MenuBookOutlined />
        </ListItemIcon>
        <ListItemText
          primary={t("settings.developer.experimental-features.epub-novel-reader.title")}
          secondary={t("settings.developer.experimental-features.epub-novel-reader.description")}
          sx={{ marginRight: 3 }}
        />
      </ListItem>
    </>
  );
}
