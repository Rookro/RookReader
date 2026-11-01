import { error } from "@tauri-apps/plugin-log";
import { DEFAULT_SETTINGS } from "../../bindings/bindings";
import { getSettings } from "../../bindings/SettingsCommands";
import type { AppSettings } from "../../types/AppSettings";

/**
 * The backend's defaults (generated), used as the Redux initial state before hydration and
 * as the fallback when loading fails.
 */
export const defaultSettings: AppSettings = DEFAULT_SETTINGS;

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
    return await getSettings();
  } catch (e) {
    error(`Failed to load settings from backend; using defaults: ${e}`);
    return defaultSettings;
  }
};
