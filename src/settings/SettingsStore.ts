import { LazyStore } from "@tauri-apps/plugin-store";
import { Settings } from "../types/Settings";

const settingsFileName = import.meta.env.DEV
  ? "rook-reader_settings_dev.json"
  : "rook-reader_settings.json";

export const settingsStore = new LazyStore(settingsFileName);

export const defaultSettings: Settings = {
  "font-family": "Inter, Avenir, Helvetica, Arial, sans-serif",
  direction: "rtl",
  "enable-directory-watch": false,
  "experimental-features": {},
  "first-page-single-view": true,
  history: {
    enable: true,
    "restore-last-container-on-startup": true,
  },
  "home-directory": "",
  log: {
    level: "Info",
  },
  "novel-reader": {
    font: "default-font",
    "font-size": 16,
  },
  rendering: {
    "enable-preview": true,
    "max-image-height": 0,
    "image-resize-method": "triangle",
    "pdf-rendering-height": 2000,
  },
  "sort-order": "NAME_ASC",
  theme: "system",
  "two-paged": true,
  "bookshelf-sort-order": "NAME_ASC",
  "bookshelf-grid-size": 1,
  "initial-view": "reader",
};

export const loadAllSettings = async (): Promise<Settings> => {
  const loadedSettings = { ...defaultSettings };

  const keys = Object.keys(defaultSettings) as Array<keyof Settings>;
  for (const key of keys) {
    const value = await settingsStore.get(key);
    if (value != null && typeof value === typeof defaultSettings[key]) {
      Object.assign(loadedSettings, { [key]: value });
    }
  }

  return loadedSettings;
};
