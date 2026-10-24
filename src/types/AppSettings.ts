/**
 * Frontend contract for application settings.
 *
 * The settings schema, defaults, and validation are owned by Rust; the TypeScript types
 * are generated into `src/bindings/bindings.ts` by `tauri-specta`. This module re-exports
 * those generated types under stable names and keeps the runtime const arrays the UI needs
 * (specta exports *types*, not *values*).
 *
 * Each settings type is generated as `_Serialize | _Deserialize`; the `_Deserialize` variant
 * has every field optional because of the container `#[serde(default)]`. Commands return the
 * fully-populated `_Serialize` variant, so these names alias it, wrapped in {@link DeepRequired}.
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

/**
 * Recursively removes optionality and nullability.
 *
 * Sound for the settings tree because the backend always returns a complete object and no
 * settings field is legitimately null. Stripping `null` also fixes the float fields, which
 * specta types as `number | null` (serde serializes non-finite `f64` as JSON `null`) even
 * though the `finite_f64` validator guarantees they are always finite at runtime.
 */
type DeepRequired<T> = T extends object ? { [K in keyof T]-?: DeepRequired<NonNullable<T[K]>> } : T;

export type AppSettings = DeepRequired<AppSettings_Serialize>;
export type ReaderSettings = DeepRequired<ReaderSettings_Serialize>;
export type RenderingSettings = DeepRequired<RenderingSettings_Serialize>;
export type GeneralSettings = DeepRequired<GeneralSettingsGen>;
export type StartupSettings = DeepRequired<StartupSettingsGen>;
export type BookshelfSettings = DeepRequired<BookshelfSettingsGen>;
export type FileNavigatorSettings = DeepRequired<FileNavigatorSettingsGen>;
export type ComicSettings = DeepRequired<ComicSettingsGen>;
export type ComicCacheSettings = DeepRequired<ComicCacheSettingsGen>;
export type LoupeSettings = DeepRequired<LoupeSettingsGen>;
export type NovelSettings = DeepRequired<NovelSettingsGen>;
export type HistorySettings = DeepRequired<HistorySettingsGen>;
export type LayoutSettings = DeepRequired<LayoutSettingsGen>;
export type SidePaneSettings = DeepRequired<SidePaneSettingsGen>;
export type LogSettings = DeepRequired<LogSettingsGen>;

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
