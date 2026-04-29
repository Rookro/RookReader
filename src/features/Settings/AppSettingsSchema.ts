import { z } from "zod";
import { imageResamplingMethods } from "../../types/AppSettings";

export const AppThemeSchema = z.enum(["light", "dark", "system"]);
export const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error"]);
export const InitialViewSchema = z.enum(["reader", "bookshelf"]);
export const SortOrderSchema = z.enum(["name_asc", "name_desc", "date_asc", "date_desc"]);
export const DirectionSchema = z.enum(["rtl", "ltr"]);
export const ImageResamplingMethodSchema = z.enum(imageResamplingMethods);

export const GeneralSettingsSchema = z.object({
  theme: AppThemeSchema,
  appFontFamily: z.string(),
  log: z.object({
    level: LogLevelSchema,
  }),
  experimentalFeatures: z.record(z.string(), z.unknown()),
});

export const StartupSettingsSchema = z.object({
  initialView: InitialViewSchema,
  restoreLastBook: z.boolean(),
  checkUpdateOnStartup: z.boolean(),
});

export const BookshelfSettingsSchema = z.object({
  sortOrder: SortOrderSchema,
  gridSize: z.number(),
  enableAutoScroll: z.boolean(),
});

export const FileNavigatorSettingsSchema = z.object({
  homeDirectory: z.string(),
  sortOrder: SortOrderSchema,
  watchDirectoryChanges: z.boolean(),
});

export const LoupeSettingsSchema = z.object({
  zoom: z.number(),
  radius: z.number(),
  toggleKey: z.string(),
});

export const ComicSettingsSchema = z.object({
  readingDirection: DirectionSchema,
  enableSpread: z.boolean(),
  showCoverAsSinglePage: z.boolean(),
  loupe: LoupeSettingsSchema,
});

export const NovelSettingsSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
});

export const RenderingSettingsSchema = z.object({
  enableThumbnailPreview: z.boolean(),
  maxImageHeight: z.number(),
  imageResamplingMethod: ImageResamplingMethodSchema,
  pdfRenderResolutionHeight: z.number(),
});

export const ReaderSettingsSchema = z.object({
  comic: ComicSettingsSchema,
  novel: NovelSettingsSchema,
  rendering: RenderingSettingsSchema,
});

export const HistorySettingsSchema = z.object({
  recordReadingHistory: z.boolean(),
});

export const AppSettingsSchema = z.object({
  general: GeneralSettingsSchema,
  startup: StartupSettingsSchema,
  bookshelf: BookshelfSettingsSchema,
  fileNavigator: FileNavigatorSettingsSchema,
  reader: ReaderSettingsSchema,
  history: HistorySettingsSchema,
});
