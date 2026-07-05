import bounds from "./settingsBounds.json";

/** A single field's validation bounds, mirrored from the backend. */
export type SettingsBound = { integer: boolean; min: number; max: number };

/**
 * Validation bounds mirrored from the backend's `FIELD_BOUNDS`
 * (`src-tauri/src/settings/validation.rs`), keyed by the camelCase dotted path.
 *
 * A Rust test (`test_bounds_agree_with_frontend_json`) asserts this JSON stays in sync
 * with `FIELD_BOUNDS`, so the setting components can consume it as the single source of
 * truth instead of hardcoding each min/max.
 */
export const SETTINGS_BOUNDS = bounds as Record<string, SettingsBound>;
