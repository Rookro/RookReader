import { Direction } from "./DirectionType";
import { LogLevel } from "./LogLevelType";
import { ResizeMethod } from "./ResizeMethod";
import { SortOrder } from "./SortOrderType";
import { AppTheme } from "./ThemeType";

/**
 * Settings.
 */
export interface Settings {
  /** font-family. */
  "font-family": string;
  /** Reading direction. */
  direction: Direction;
  /** Enable directory watch feature. */
  "enable-directory-watch": boolean;
  /** Experimental features settings. */
  "experimental-features": ExperimentalFeaturesSettings;
  /** Show first page by single view. */
  "first-page-single-view": boolean;
  /** History settings. */
  history: HistorySettings;
  /** Home directory path. */
  "home-directory": string;
  /** Log settings. */
  log: LogSettings;
  /** Novel reader settings. */
  "novel-reader": NovelReaderSettings;
  /** Rendering settings. */
  rendering: RenderingSettings;
  /** Sort order of file navigator. */
  "sort-order": SortOrder;
  /** Theme settings. */
  theme: AppTheme;
  /** Enable two-paged view. */
  "two-paged": boolean;
}

/**
 * History settings.
 */
export interface HistorySettings {
  /** Enable history feature. */
  enable: boolean;
  /** Restore last container on startup. */
  "restore-last-container-on-startup": boolean;
}

/**
 * Log settings.
 */
export interface LogSettings {
  /** Log level. */
  level: LogLevel;
}

/**
 * Novel reader settings.
 */
export interface NovelReaderSettings {
  /** font. */
  font?: string;
  /** font size. */
  "font-size"?: number;
}

/**
 * Rendering settings.
 */
export interface RenderingSettings {
  /** Enable preview feature. */
  "enable-preview": boolean;
  /** Maximum image height. */
  "max-image-height": number;
  /** Image resize method. */
  "image-resize-method": ResizeMethod;
  /** PDF rendering height. */
  "pdf-rendering-height": number;
}

/**
 * Experimental features settings.
 */
export interface ExperimentalFeaturesSettings {
  /** To avoid empty interface .*/
  dummy?: never;
}
