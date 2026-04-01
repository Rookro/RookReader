import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { defaultSettings, settingsStore } from "./settingsStore";
import { createAppAsyncThunk } from "../../types/CustomAsyncThunk";
import { error } from "@tauri-apps/plugin-log";
import { ErrorCode } from "../../types/Error";
import { AppSettings } from "../../types/AppSettings";

/**
 * Payload type for updating a setting value in the settings store.
 */
type UpdateSettingsPayload = {
  [K in keyof AppSettings]: { key: K; value: Partial<AppSettings[K]> };
}[keyof AppSettings];

/**
 * Updates a setting value in the settings store.
 *
 * @param args - The arguments for updating the setting.
 * @param args.key - The key of the setting to update.
 * @param args.value - The new value for the setting. If the value is an object, it partially updates the properties.
 * @returns A thunk that resolves to the updated setting value.
 */
export const updateSettings = createAppAsyncThunk(
  "settings/updateSettings",
  async ({ key, value }: UpdateSettingsPayload, { getState, rejectWithValue }) => {
    if (key === undefined) {
      const errorMessage = "Failed to updateSettings. Error: Key is undefined.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.SETTINGS_ERROR, message: errorMessage });
    }

    const target = getState().settings[key];

    if (isPlainObject(target) && isPlainObject(value)) {
      const newValue = { ...target, ...value } as AppSettings[keyof AppSettings];
      await settingsStore.set(key, newValue);
      return { key, value: newValue };
    } else {
      await settingsStore.set(key, value);
      return { key, value: value as AppSettings[keyof AppSettings] };
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
     * @param action - Payload containing the complete Settings object.
     */
    setSettings: (_state, action: PayloadAction<AppSettings>) => {
      return action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(updateSettings.fulfilled, (state, action) => {
      const { key, value } = action.payload;
      // Call the helper to bypass the union type assignment error.
      applySettingUpdate(state, key, value);
    });
  },
});

/**
 * Helper to update state properties with strict type mapping.
 * * **Technical Reason:**
 * Generic `<K>` is used to re-establish the 1:1 relationship between
 * the key and its value type, bypassing 'never' type errors that occur
 * when indexing with broad union types like `keyof Settings`.
 */
function applySettingUpdate<K extends keyof AppSettings>(
  state: AppSettings,
  key: K,
  value: AppSettings[K],
) {
  state[key] = value;
}

/**
 * Type guard to check if a value is a plain object (not an array or null).
 */
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

export const { setSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
