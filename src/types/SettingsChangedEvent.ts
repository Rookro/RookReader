import type { AppSettings } from "./AppSettings";

/**
 * Represents the settings related to localization and language.
 */
export type LocaleSettings = {
  /**
   * The language to be used in the application UI.
   * @example "en-US"
   * @example "ja-JP"
   */
  language?: string;
};

/**
 * Represents the payload of the 'settings-changed' event.
 * This object contains one or more settings categories that have been modified.
 * It's structured to allow partial updates, so only the keys for the changed settings will be present.
 */
export interface SettingsChangedEvent {
  /** The locale settings for the application. */
  locale?: LocaleSettings;
  /** The app settings for the application. */
  appSettings?: Partial<AppSettings>;
}
