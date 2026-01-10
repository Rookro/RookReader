import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Switch, Typography } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setIsHistoryEnabled } from "../../../../reducers/HistoryReducer";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { SettingsChangedEvent } from "../../../../types/SettingsChangedEvent";

/**
 * History feature toggle component.
 */
export default function FeatureToggle() {
    const { t } = useTranslation();
    const { isHistoryEnabled } = useAppSelector(state => state.history);
    const dispatch = useAppDispatch();
    const [restoreLastContainer, setRestoreLastContainer] = useState(false);


    // Initializes the history settings from the settings store when the component mounts.
    useEffect(() => {
        const init = async () => {
            const isHistoryEnabled = await settingsStore.get<boolean>("enable-history") ?? true;
            dispatch(setIsHistoryEnabled(isHistoryEnabled));
            const restoreLastContainer = await settingsStore.get<boolean>("restore-last-container-on-startup") ?? true;
            setRestoreLastContainer(restoreLastContainer);
        };
        init();
    }, [dispatch]);

    const handleHistoryFeatureToggleChanged = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setIsHistoryEnabled(e.target.checked));
        await settingsStore.set("enable-history", e.target.checked);
        await emit<SettingsChangedEvent>("settings-changed", { history: { isEnabled: e.target.checked } });
    }, [dispatch]);

    const handleRestoreFeatureToggleChanged = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        setRestoreLastContainer(e.target.checked);
        await settingsStore.set("restore-last-container-on-startup", e.target.checked);
    }, []);

    return (
        <Stack>
            <Box display="flex">
                <Typography alignContent="center" sx={{ paddingRight: "12px" }}>
                    {t('settings.history.feature-toggle.title')}
                </Typography>
                <Switch
                    checked={isHistoryEnabled}
                    onChange={handleHistoryFeatureToggleChanged}
                />
            </Box>
            <Box display="flex">
                <Typography alignContent="center" sx={{ paddingRight: "12px" }}>
                    {t('settings.history.restore-toggle.title')}
                </Typography>
                <Switch
                    checked={restoreLastContainer}
                    onChange={handleRestoreFeatureToggleChanged}
                />
            </Box>
        </Stack>
    );
}
