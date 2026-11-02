/**
 * Frontend contract for application settings.
 *
 * The settings schema, defaults, and validation are owned by Rust; the TypeScript types
 * are generated into `src/bindings/bindings.ts` by `tauri-specta`. This module re-exports
 * those generated types under stable names and keeps the runtime const arrays the UI needs
 * (the UI's option lists are not generated).
 *
 * Each settings type is generated as `_Serialize | _Deserialize`; the `_Deserialize` variant
 * has every field optional because of the container `#[serde(default)]`. Commands return the
 * fully-populated `_Serialize` variant, so these names alias it.
 */
import type {
  AppSettings_Serialize,
  BookshelfSettings_Serialize as BookshelfSettingsGen,
  ComicCacheSettings_Serialize as ComicCacheSettingsGen,
  ComicSettings_Serialize as ComicSettingsGen,
  FileNavigatorSettings_Serialize as FileNavigatorSettingsGen,
  GeneralSettings_Serialize as GeneralSettingsGen,
  HistorySettings_Serialize as HistorySettingsGen,
  LayoutSettings_Serialize as LayoutSettingsGen,
  LogSettings_Serialize as LogSettingsGen,
  LoupeSettings_Serialize as LoupeSettingsGen,
  NovelSettings_Serialize as NovelSettingsGen,
  ReaderSettings_Serialize,
  RenderingSettings_Serialize,
  SidePaneSettings_Serialize as SidePaneSettingsGen,
  StartupSettings_Serialize as StartupSettingsGen,
} from "../bindings/bindings";

export type AppSettings = AppSettings_Serialize;
export type ReaderSettings = ReaderSettings_Serialize;
export type RenderingSettings = RenderingSettings_Serialize;
export type GeneralSettings = GeneralSettingsGen;
export type StartupSettings = StartupSettingsGen;
export type BookshelfSettings = BookshelfSettingsGen;
export type FileNavigatorSettings = FileNavigatorSettingsGen;
export type ComicSettings = ComicSettingsGen;
export type ComicCacheSettings = ComicCacheSettingsGen;
export type LoupeSettings = LoupeSettingsGen;
export type NovelSettings = NovelSettingsGen;
export type HistorySettings = HistorySettingsGen;
export type LayoutSettings = LayoutSettingsGen;
export type SidePaneSettings = SidePaneSettingsGen;
export type LogSettings = LogSettingsGen;

/** String-union enums (no optionality concern — re-exported directly). */
export type {
  AppTheme,
  AutoOpenAdjacentBookMode,
  Direction,
  ImageResamplingMethod_Serialize as ImageResamplingMethod,
  InitialView,
  LogLevel,
  SortOrder,
} from "../bindings/bindings";

import type {
  AutoOpenAdjacentBookMode,
  Direction,
  ImageResamplingMethod_Serialize,
} from "../bindings/bindings";

/** The algorithms available for resampling (resizing) images (UI dropdown order). */
export const imageResamplingMethods = [
  "nearest",
  "box",
  "bilinear",
  "hamming",
  "catmullRom",
  "mitchellNetravali",
  "lanczos3",
] as const satisfies readonly ImageResamplingMethod_Serialize[];

/** The available comic reading directions (UI dropdown order). */
export const directions = ["rtl", "ltr"] as const satisfies readonly Direction[];

/** The available modes for auto-opening the adjacent book (UI dropdown order). */
export const autoOpenAdjacentBookModes = [
  "off",
  "ask",
  "auto",
] as const satisfies readonly AutoOpenAdjacentBookMode[];
