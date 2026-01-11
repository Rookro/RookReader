import { useTranslation } from "react-i18next";
import { List } from "@mui/material";
import LogSetting from "./Items/LogSetting";
import SettingsPanel from "../SettingsPanel";

/**
 * Developer settings component.
 */
export default function DeveloperSettings() {
    const { t } = useTranslation();

    return (
        <SettingsPanel title={t('settings.developer.title')}>
            <List>
                <LogSetting />
            </List>
        </SettingsPanel>
    );
}
