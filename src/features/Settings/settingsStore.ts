import { LazyStore } from "@tauri-apps/plugin-store";
import { AppSettings } from "../../types/AppSettings";

const settingsFileName = import.meta.env.DEV
  ? "rook-reader_settings_dev.json"
  : "rook-reader_settings.json";

export const settingsStore = new LazyStore(settingsFileName);

export const defaultSettings: AppSettings = {
  general: {
    theme: "system",
    appFontFamily: "Inter, Avenir, Helvetica, Arial, sans-serif",
    log: {
      level: "info",
    },
    experimentalFeatures: {},
  },
  startup: {
    initialView: "reader",
    restoreLastBook: true,
    checkUpdateOnStartup: true,
  },
  bookshelf: {
    sortOrder: "name_asc",
    gridSize: 1,
  },
  fileNavigator: {
    homeDirectory: "",
    sortOrder: "name_asc",
    watchDirectoryChanges: false,
  },
  reader: {
    comic: {
      readingDirection: "rtl",
      enableSpread: true,
      showCoverAsSinglePage: true,
    },
    novel: {
      fontFamily: "default-font",
      fontSize: 16,
    },
    rendering: {
      enableThumbnailPreview: true,
      maxImageHeight: 0,
      imageResamplingMethod: "triangle",
      pdfRenderResolutionHeight: 2000,
    },
  },
  history: {
    recordReadingHistory: true,
  },
};

export const loadAllSettings = async (): Promise<AppSettings> => {
  const loadedSettings = { ...defaultSettings };

  const keys = Object.keys(defaultSettings) as Array<keyof AppSettings>;
  for (const key of keys) {
    const value = await settingsStore.get(key);
    if (value != null && typeof value === typeof defaultSettings[key]) {
      Object.assign(loadedSettings, { [key]: value });
    }
  }

  return loadedSettings;
};
