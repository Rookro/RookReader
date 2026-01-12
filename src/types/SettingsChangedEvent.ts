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
 * Represents the settings for view.
 */
export type ViewSettings = {
  /**
   * Whether to show the first page as a single view.
   * When true, the first page is shown alone. When false, it may be paired with the next page.
   */
  isFirstPageSingleView?: boolean;
};

/**
 * Represents the settings for file navigator.
 */
export type FileNavigatorSettings = {
  /**
   * Whether to watch the directory for changes.
   * If true, the file navigator will update in real-time when the underlying filesystem changes.
   */
  isDirWatchEnabled?: boolean;
};

/**
 * Represents the settings for history.
 */
export type HistorySettings = {
  /**
   * Whether to enable history.
   * If true, recently opened files will be tracked.
   */
  isEnabled?: boolean;
};

/**
 * Represents the payload of the 'settings-changed' event.
 * This object contains one or more settings categories that have been modified.
 * It's structured to allow partial updates, so only the keys for the changed settings will be present.
 */
export type SettingsChangedEvent = {
  /**
   * The locale settings.
   */
  locale?: LocaleSettings;
  /**
   * The view settings.
   */
  view?: ViewSettings;
  /**
   * The file navigator settings.
   */
  fileNavigator?: FileNavigatorSettings;
  /**
   * The history settings.
   */
  history?: HistorySettings;
};
