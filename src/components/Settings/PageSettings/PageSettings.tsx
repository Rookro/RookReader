import { useTranslation } from "react-i18next";
import { List } from "@mui/material";
import FirstPageSetting from "./Items/FirstPageSetting";
import SettingsPanel from "../SettingsPanel";

/**
 * Page settings component.
 */
export default function PageSettings() {
    const { t } = useTranslation();

    return (
        <SettingsPanel title={t('settings.page.title')}>
            <List>
                <FirstPageSetting />
            </List>
        </SettingsPanel>

    );
}
