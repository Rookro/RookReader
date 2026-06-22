import { error } from "@tauri-apps/plugin-log";
import { commands } from "../../bindings/bindings";
import { getDataOrThrow } from "../../bindings/result";
import type { AppSettings } from "../../types/AppSettings";

/**
 * Synchronous bootstrap fixture for settings.
 *
 * The backend is the source of truth for runtime defaults (delivered via `get_settings`);
 * this object exists only as the Redux `initialState` before hydration and as a test
 * fixture. Note font sizes are plain numbers (Rust `f64`), e.g. `fontSize: 16`.
 */
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
    enableAutoScroll: true,
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
        zoom: 2.0,
        radius: 200,
        toggleKey: "MouseMiddle",
      },
      cache: {
        preloadPageCount: 10,
        imageCacheSizeMib: 1024,
      },
    },
    novel: {
      fontFamily: "default-font",
      fontSize: 16,
    },
    rendering: {
      enableThumbnailPreview: true,
      maxImageHeight: 0,
      imageResamplingMethod: "bilinear",
      pdfRenderResolutionHeight: 2000,
    },
    autoOpenAdjacentBook: "ask",
  },
  history: {
    recordReadingHistory: true,
  },
  layout: {
    sidePane: {
      isHidden: false,
      tabIndex: 0,
    },
  },
};

/**
 * Loads the authoritative settings from the backend (`get_settings`).
 *
 * Falls back to {@link defaultSettings} (logged) if the backend load fails, so the app
 * still renders.
 *
 * @returns The current application settings.
 */
export const loadAllSettings = async (): Promise<AppSettings> => {
  try {
    // The backend always returns a complete settings object; the generated type marks
    // fields optional (container serde default), so assert the required-field shape.
    return getDataOrThrow(await commands.getSettings()) as AppSettings;
  } catch (e) {
    error(`Failed to load settings from backend; using defaults: ${e}`);
    return defaultSettings;
  }
};
