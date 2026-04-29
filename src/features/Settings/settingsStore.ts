import { error } from "@tauri-apps/plugin-log";
import { LazyStore } from "@tauri-apps/plugin-store";
import { deepmerge } from "deepmerge-ts";
import type { AppSettings } from "../../types/AppSettings";
import { AppSettingsSchema } from "./AppSettingsSchema";

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
      loupe: {
        zoom: 2,
        radius: 200,
        toggleKey: "MouseMiddle",
      },
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

/**
 * Loads all settings from the store, merging with defaults and validating with Zod.
 */
export const loadAllSettings = async (): Promise<AppSettings> => {
  const savedSettings: Record<string, unknown> = {};

  const keys = Object.keys(defaultSettings) as Array<keyof AppSettings>;
  for (const key of keys) {
    const value = await settingsStore.get(key);
    if (value != null) {
      savedSettings[key] = value;
    }
  }

  // Deep merge defaults with saved settings
  const merged = deepmerge(defaultSettings, savedSettings);

  // Validate and strip unknown properties using Zod
  const result = AppSettingsSchema.safeParse(merged);

  if (!result.success) {
    error(`Failed to validate settings, falling back to defaults: ${result.error.message}`);
    return defaultSettings;
  }

  return result.data as AppSettings;
};
