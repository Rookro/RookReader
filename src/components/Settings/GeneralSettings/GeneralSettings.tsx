import { useTranslation } from "react-i18next";
import { Divider, List } from "@mui/material";
import ThemeSetting from "./Items/ThemeSetting"
import LanguageSetting from "./Items/LanguageSettings";
import SettingsPanel from "../SettingsPanel";

/**
 * General settings component.
 */
export default function GeneralSettings() {
    const { t } = useTranslation();

    return (
        <SettingsPanel title={t('settings.general.title')}>
            <List>
                <LanguageSetting />
                <Divider />
                <ThemeSetting />
            </List>
        </SettingsPanel>
    );
}
