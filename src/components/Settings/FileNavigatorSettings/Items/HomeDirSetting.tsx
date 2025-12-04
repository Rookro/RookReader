import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, IconButton, OutlinedInput, Stack, Typography } from "@mui/material";
import { Folder } from "@mui/icons-material";
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from "@tauri-apps/api/path";
import { settingsStore } from "../../../../settings/SettingsStore";
import { error } from "@tauri-apps/plugin-log";

/**
 * Home directory setting component.
 */
export default function HomeDirSetting() {
    const { t } = useTranslation();
    const [homeDirPath, setHomeDirPath] = useState<string>("");

    const handleFolderClicked = async (_e: React.MouseEvent<HTMLButtonElement>) => {
        try {
            const directory = await open({
                multiple: false,
                directory: true,
            });
            if (!directory) {
                return;
            }
            setHomeDirPath(directory);
            await settingsStore.set("home-directory", directory);
        } catch (e) {
            error(`${e}`);
        }
    }

    useEffect(() => {
        const initView = async () => {
            const homeDirPathSetting = await settingsStore.get("home-directory") as string | undefined;
            setHomeDirPath(homeDirPathSetting ?? await homeDir());
        };
        initView();
    }, [])

    const handleHomeDirPathChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setHomeDirPath(e.target.value);
        await settingsStore.set("home-directory", { level: e.target.value });
    }

    return (
        <Stack spacing={1} >
            <Box display="flex">
                <Typography alignContent="center">{t('settings.file-navigator.home-directory-title')}</Typography>
                <OutlinedInput
                    type="text"
                    value={homeDirPath}
                    onChange={handleHomeDirPathChanged}
                    size="small"
                    sx={{
                        width: '80%',
                        marginLeft: '16px',
                        marginRight: '5px',
                    }}
                />
                <IconButton size="small" onClick={handleFolderClicked} >
                    <Folder />
                </IconButton>
            </Box>
        </Stack>
    );
}
