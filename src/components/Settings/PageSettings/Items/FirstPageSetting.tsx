import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Typography, Box, Switch } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { settingsStore } from "../../../../settings/SettingsStore";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { setIsFirstPageSingleView } from "../../../../reducers/ViewReducer";
import { debug } from "@tauri-apps/plugin-log";


/**
 * First page setting component.
 */
export default function FirstPageSetting() {
    const { t } = useTranslation();
    const { isFirstPageSingleView } = useAppSelector(state => state.view);
    const dispatch = useAppDispatch();

    useEffect(() => {
        const initSettings = async () => {
            const isFirstPageSingleView = await settingsStore.get<boolean>("first-page-single-view") ?? true;
            dispatch(setIsFirstPageSingleView(isFirstPageSingleView));
        }
        initSettings();
    }, [dispatch])

    const handleFirstPageSingleViewSwitchChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        debug(`First page single view switch changed to ${e.target.checked}`);
        dispatch(setIsFirstPageSingleView(e.target.checked));
        await settingsStore.set("first-page-single-view", e.target.checked);

        // The Store state is isolated within each WebView context and is not reflected in the main window's Store.
        // Notify the main window to apply the changes.
        await emit("view-settings-changed", {
            key: "isFirstPageSingleView",
            value: e.target.checked
        });
    }, [dispatch]);

    debug(`First page single view: ${isFirstPageSingleView}`)
    return (
        <Box display="flex">
            <Typography alignContent="center" sx={{ paddingRight: "12px" }}>
                {t('settings.page.first-page.title')}
            </Typography>
            <Switch
                checked={isFirstPageSingleView}
                onChange={handleFirstPageSingleViewSwitchChange}
            />
        </Box>
    );
}
