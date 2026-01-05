import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, Switch, Typography } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { settingsStore } from "../../../../settings/SettingsStore";
import { setIsHistoryEnabled } from "../../../../reducers/HistoryReducer";
import { useAppDispatch, useAppSelector } from "../../../../Store";


async function emitHistorySettingsChanged(isEnabled: boolean) {
    // The Store state is isolated within each WebView context and is not reflected in the main window's Store.
    // Notify the main window to apply the changes.
    await emit("history-settings-changed", {
        key: "isHistoryEnabled",
        value: isEnabled
    });
}

/**
 * History feature toggle component.
 */
export default function FeatureToggle() {
    const { t } = useTranslation();
    const { isHistoryEnabled } = useAppSelector(state => state.history);
    const dispatch = useAppDispatch();

    useEffect(() => {
        const initHistoryFeature = async () => {
            const isHistoryEnabled = await settingsStore.get<boolean>("enable-history") ?? true;
            dispatch(setIsHistoryEnabled(isHistoryEnabled));
        };
        initHistoryFeature();
    }, [dispatch]);

    const handleFeatureToggleChanged = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setIsHistoryEnabled(e.target.checked));
        await settingsStore.set("enable-history", e.target.checked);
        await emitHistorySettingsChanged(e.target.checked);
    }, [dispatch]);

    return (
        <Box display="flex">
            <Typography alignContent="center" sx={{ paddingRight: "12px" }}>
                {t('settings.history.feature-toggle.title')}
            </Typography>
            <Switch
                checked={isHistoryEnabled}
                onChange={handleFeatureToggleChanged}
            />
        </Box>
    );
}
