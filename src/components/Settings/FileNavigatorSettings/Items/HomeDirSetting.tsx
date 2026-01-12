import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, ListItem, ListItemIcon, ListItemText, TextField } from "@mui/material";
import { Folder, HomeOutlined } from "@mui/icons-material";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";
import { settingsStore } from "../../../../settings/SettingsStore";

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
  };

  useEffect(() => {
    const initView = async () => {
      const homeDirPathSetting = (await settingsStore.get("home-directory")) as string | undefined;
      setHomeDirPath(homeDirPathSetting ?? (await homeDir()));
    };
    initView();
  }, []);

  const handleHomeDirPathChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setHomeDirPath(e.target.value);
    await settingsStore.set("home-directory", e.target.value);
  };

  return (
    <ListItem>
      <ListItemIcon>
        <HomeOutlined />
      </ListItemIcon>
      <ListItemText primary={t("settings.file-navigator.home-directory-title")} />
      <TextField
        variant="standard"
        value={homeDirPath}
        onChange={handleHomeDirPathChanged}
        size="small"
        sx={{
          width: "80%",
          marginLeft: "4px",
          marginRight: "4px",
        }}
      />
      <IconButton size="small" onClick={handleFolderClicked}>
        <Folder />
      </IconButton>
    </ListItem>
  );
}
