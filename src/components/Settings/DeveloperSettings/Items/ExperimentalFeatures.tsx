import { useTranslation } from "react-i18next";
import { ScienceOutlined } from "@mui/icons-material";
import { ListItem, ListItemIcon, ListItemText } from "@mui/material";

/**
 * Experimental features settings component.
 */
export default function ExperimentalFeatures() {
  const { t } = useTranslation();

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
    </>
  );
}
