import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, IconButton, ListItem, ListItemIcon, ListItemText, TextField } from "@mui/material";
import { Folder, HomeOutlined } from "@mui/icons-material";
import { open } from "@tauri-apps/plugin-dialog";
import { error } from "@tauri-apps/plugin-log";
import { useAppDispatch, useAppSelector } from "../../../../Store";
import { updateSettings } from "../../../../reducers/SettingsReducer";
import { homeDir } from "@tauri-apps/api/path";

/**
 * Home directory setting component.
 */
export default function HomeDirSetting() {
  const { t } = useTranslation();
  const fileNavigatorSettings = useAppSelector((store) => store.settings.fileNavigator);
  const dispatch = useAppDispatch();
  const [homeDirPath, setHomeDirPath] = useState<string>(fileNavigatorSettings.homeDirectory);

  useEffect(() => {
    if (homeDirPath.length < 1) {
      (async () => {
        const dir = await homeDir();
        setHomeDirPath(dir);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mounted once
  }, []);

  const handleFolderClicked = useCallback(
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
      try {
        const directory = await open({
          multiple: false,
          directory: true,
        });
        if (!directory) {
          return;
        }
        setHomeDirPath(directory);
        const newFileNavigatorSettings = { ...fileNavigatorSettings, homeDirectory: directory };
        dispatch(updateSettings({ key: "fileNavigator", value: newFileNavigatorSettings }));
      } catch (e) {
        error(`${e}`);
      }
    },
    [dispatch, fileNavigatorSettings],
  );

  const formAction = useCallback(
    async (formData: FormData) => {
      const inputPath = formData.get("path")?.toString();

      if (inputPath && inputPath !== homeDirPath) {
        setHomeDirPath(inputPath);
        const newFileNavigatorSettings = { ...fileNavigatorSettings, homeDirectory: inputPath };
        dispatch(updateSettings({ key: "fileNavigator", value: newFileNavigatorSettings }));
      }
    },
    [dispatch, fileNavigatorSettings, homeDirPath],
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.form?.requestSubmit();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <ListItem>
      <ListItemIcon>
        <HomeOutlined />
      </ListItemIcon>
      <ListItemText primary={t("settings.file-navigator.home-directory-title")} />
      <Box component="form" action={formAction} sx={{ flexGrow: 1 }}>
        <TextField
          variant="standard"
          key={homeDirPath}
          name="path"
          defaultValue={homeDirPath}
          onContextMenu={handleContextMenu}
          onBlur={handleBlur}
          size="small"
          sx={{
            width: "80%",
            marginLeft: "4px",
            marginRight: "4px",
          }}
        />
      </Box>
      <IconButton size="small" onClick={handleFolderClicked}>
        <Folder />
      </IconButton>
    </ListItem>
  );
}
