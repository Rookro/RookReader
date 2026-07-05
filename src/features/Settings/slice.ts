import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import type { SettingsPatch } from "../../bindings/bindings";
import { setSettings as persistSettings } from "../../bindings/SettingsCommands";
import type { AppSettings } from "../../types/AppSettings";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import { CommandError, ErrorCode } from "../../types/Error";
import { setSettingsError } from "./errorSlice";
import { defaultSettings } from "./settingsStore";

type DepthLimit = [never, 0, 1, 2, 3, 4, 5];

/** A partial of `T` to an arbitrary (depth-limited) nesting — used for the changed leaf. */
type DeepPartial<T, Depth extends number = 5> = [Depth] extends [never]
  ? T
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P], DepthLimit[Depth]> }
    : T;

/** A `{ key, value }` pair where `value` is a deep-partial of exactly that category. */
export type UpdateSettingsPayload = {
  [K in keyof AppSettings]: { key: K; value: DeepPartial<AppSettings[K]> };
}[keyof AppSettings];

/**
 * Persists a single changed settings leaf and replaces the slice with the result.
 *
 * Only the changed leaf (a deep-partial of one category) is sent as a `SettingsPatch`.
 * The backend deep-merges it into the current settings, validates the merged whole,
 * persists it, and returns the full merged `AppSettings`; the `fulfilled` reducer then
 * replaces the entire slice with that returned value. There is no client-side merge.
 *
 * @param args - The category `key` and the changed-leaf `value` (a deep-partial).
 * @returns The full merged settings returned by the backend.
 */
export const updateSettings = createAppAsyncThunk(
  "settings/updateSettings",
  async ({ key, value }: UpdateSettingsPayload, { dispatch, rejectWithValue }) => {
    const patch = { [key]: value } as unknown as SettingsPatch;
    try {
      return await persistSettings(patch);
    } catch (e) {
      const code = e instanceof CommandError ? e.code : ErrorCode.SETTINGS_ERROR;
      const message = e instanceof CommandError ? e.message : String(e);
      const details = e instanceof CommandError ? e.details : undefined;
      error(`Failed to persist settings: ${message}`);
      // Structured field violations are shown inline next to the offending field by the
      // component (via the rejected payload's `details`). Only raise the centralized
      // notification for generic (non-field) settings errors.
      if (!details?.length) {
        dispatch(setSettingsError({ code, message }));
      }
      return rejectWithValue({ code, message, details });
    }
  },
);

export const settingsSlice = createSlice({
  name: "settings",
  initialState: defaultSettings,
  reducers: {
    /**
     * Replaces the entire settings state with the provided settings object.
     *
     * @param _state - The current Redux state slice.
     * @param action - Payload containing the complete settings object.
     */
    setSettings: (_state, action: PayloadAction<AppSettings>) => {
      return action.payload;
    },
  },
  extraReducers: (builder) => {
    // `set_settings` returns the merged settings → replace the slice with it.
    builder.addCase(updateSettings.fulfilled, (_state, action) => action.payload);
  },
});

export const { setSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
