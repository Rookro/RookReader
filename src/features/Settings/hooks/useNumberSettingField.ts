import { useCallback } from "react";
import { useAppSelector } from "../../../store/store";
import { SETTINGS_BOUNDS } from "../settingsBounds";
import type { SettingsFieldPath } from "../settingsFieldErrors";
import { patchAt, settingAt } from "../settingsPath";
import { defaultSettings } from "../settingsStore";
import { useSettingsFieldError } from "./useSettingsFieldError";

/** The props a number setting's spinner takes from {@link useNumberSettingField}. */
export interface NumberSettingField {
  /** The stored value. */
  defaultValue: number;
  /** The smallest valid value. */
  min: number;
  /** The largest valid value. */
  max: number;
  /** Whether the backend rejected the last committed value. */
  error: boolean;
  /** The message for that rejection, or `""`. */
  helperText: string;
  /** Saves a value; a cleared field (`null`) saves the field's default. */
  onValueCommitted: (value: number | null) => Promise<void>;
}

/**
 * Wires one number setting to the store, its bounds and its inline validation message.
 *
 * @param path - The setting's dotted path, e.g. `"reader.novel.fontSize"`.
 * @returns The props to spread onto `NumberSpinnerSettingItem`.
 */
export function useNumberSettingField(path: SettingsFieldPath): NumberSettingField {
  const value = useAppSelector((state) => settingAt(state.settings, path));
  const { error, helperText, commit } = useSettingsFieldError(path, value);

  const onValueCommitted = useCallback(
    async (committed: number | null) => {
      await commit(patchAt(path, committed ?? settingAt(defaultSettings, path)));
    },
    [commit, path],
  );

  const { min, max } = SETTINGS_BOUNDS[path];
  return { defaultValue: value, min, max, error, helperText, onValueCommitted };
}
