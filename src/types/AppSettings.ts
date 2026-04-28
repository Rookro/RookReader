/** Application settings */
export interface AppSettings {
  /** General application settings, including theming and fonts.*/
  general: GeneralSettings;
  /** Settings related to the application's startup behavior. */
  startup: StartupSettings;
  /** Settings specific to the bookshelf (library) view. */
  bookshelf: BookshelfSettings;
  /** Settings for the file navigator and directory management. */
  fileNavigator: FileNavigatorSettings;
  /** Settings for reading content (both comics and novels). */
  reader: ReaderSettings;
  /** Settings related to user history and tracking. */
  history: HistorySettings;
}

/** General application settings. */
export interface GeneralSettings {
  /** The application's color theme. */
  theme: AppTheme;
  /** The font family used for the application's UI. */
  appFontFamily: string;
  /** Configuration for application logging. */
  log: LogSettings;
  /** Configuration for experimental features. */
  experimentalFeatures: ExperimentalFeaturesSettings;
}

/** Configuration for application logging. */
export interface LogSettings {
  /** The minimum severity level to log. */
  level: LogLevel;
}

/** Settings related to the application's startup behavior. */
export interface StartupSettings {
  /** The initial view presented to the user upon launch. */
  initialView: "reader" | "bookshelf";
  /** Whether to automatically restore the last opened book/container on startup. */
  restoreLastBook: boolean;
  /** Whether to automatically check for updates on startup. */
  checkUpdateOnStartup: boolean;
}

/** Settings specific to the bookshelf view. */
export interface BookshelfSettings {
  /** The criteria used to sort items in the bookshelf. */
  sortOrder: SortOrder;
  /** The number of size to display in the bookshelf grid. */
  gridSize: number;
}

/** Settings for the file navigator. */
export interface FileNavigatorSettings {
  /** The default directory opened when clicking the Home button. */
  homeDirectory: string;
  /** The criteria used to sort files and directories. */
  sortOrder: SortOrder;
  /** Whether to automatically watch the current directory for file changes. */
  watchDirectoryChanges: boolean;
}

/**  Settings for the reading experience. */
export interface ReaderSettings {
  /** Configuration specific to reading comics/manga (images). */
  comic: ComicSettings;
  /** Configuration specific to reading novels (text). */
  novel: NovelSettings;
  /** Configuration for how pages and previews are rendered. */
  rendering: RenderingSettings;
}

/** Configuration specific to reading comics (image-based content). */
export interface ComicSettings {
  /** The reading direction (e.g., Right-to-Left for Japanese manga). */
  readingDirection: Direction;
  /** Whether to display pages side-by-side (two-page spread). */
  enableSpread: boolean;
  /** Whether to force the first page (cover) to display as a single page in spread mode. */
  showCoverAsSinglePage: boolean;
  /** Configuration for the Loupe (Magnifier) feature. */
  loupe: LoupeSettings;
}

/** Configuration for the Loupe (Magnifier) feature. */
export interface LoupeSettings {
  /** The magnification zoom level of the loupe. */
  zoom: number;
  /** The radius (size) of the loupe. */
  radius: number;
  /** The keyboard shortcut key to toggle the loupe. */
  toggleKey: string;
}

/** Configuration specific to reading novels (text-based content).*/
export interface NovelSettings {
  /** The font family used for rendering the text. */
  fontFamily: string;
  /** The size of the font used for rendering the text. */
  fontSize: number;
}

/** Configuration for image and document rendering. */
export interface RenderingSettings {
  /** Whether to generate and display thumbnail previews for pages. */
  enableThumbnailPreview: boolean;
  /** The maximum allowed height for an image before it is scaled down. */
  maxImageHeight: number;
  /** The algorithm used for resampling (resizing) images. */
  imageResamplingMethod: ImageResamplingMethod;
  /** The vertical resolution used when rasterizing PDF pages to images. */
  pdfRenderResolutionHeight: number;
}

/** Settings related to tracking user history. */
export interface HistorySettings {
  /** Whether to record the user's reading history and progress. */
  recordReadingHistory: boolean;
}

/** Represents the application's visual theme. */
export type AppTheme = "light" | "dark" | "system";

/** Represents the severity level for application logs. */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/** Represents the initial view shown when the app starts. */
export type InitialView = "reader" | "bookshelf";

/** Represents the criteria used for sorting items. */
export type SortOrder = "name_asc" | "name_desc" | "date_asc" | "date_desc";

/** Represents the direction in which content should be read. */
export type Direction = "rtl" | "ltr";

/** The algorithms used for resampling (resizing) images. */
export const imageResamplingMethods = [
  "nearest",
  "triangle",
  "catmullRom",
  "gaussian",
  "lanczos3",
] as const;

/** Represents the algorithm used for resampling (resizing) images. */
export type ImageResamplingMethod = (typeof imageResamplingMethods)[number];

/** Configuration for experimental features. */
export interface ExperimentalFeaturesSettings {
  /** To avoid empty interface .*/
  dummy?: never;
}
