import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Typography, Box, Switch, Stack } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { setIsWatchEnabled } from "../../../../reducers/FileReducer";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";

/**
 * Directory watch setting component.
 */
export default function DirWatchSetting() {
    const { t } = useTranslation();
    const { isWatchEnabled } = useAppSelector(state => state.file.explorer);
    const dispatch = useAppDispatch();

    useEffect(() => {
        const initSettings = async () => {
            const isWatchEnabled = await settingsStore.get<boolean>("enable-directory-watch") ?? false;
            dispatch(setIsWatchEnabled(isWatchEnabled));
        }
        initSettings();
    }, [dispatch])

    const handleIsWatchEnabledChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        debug(`Enable directory watch to ${e.target.checked}`);
        dispatch(setIsWatchEnabled(e.target.checked));
        await settingsStore.set("enable-directory-watch", e.target.checked);
        await emit<SettingsChangedEvent>("settings-changed", { fileNavigator: { isDirWatchEnabled: e.target.checked } });
    }, [dispatch]);

    return (
        <Stack>
            <Box display="flex">
                <Typography alignContent="center" sx={{ paddingRight: "12px" }}>
                    {t('settings.file-navigator.dir-watch.title')}
                </Typography>
                <Switch
                    checked={isWatchEnabled}
                    onChange={handleIsWatchEnabledChange}
                />
            </Box>
            <Typography>
                {t('settings.file-navigator.dir-watch.warn-message')}
            </Typography>
        </Stack>
    );
}
