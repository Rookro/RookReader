import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Settings } from "../types/Settings";
import { defaultSettings, settingsStore } from "../settings/SettingsStore";
import { createAppAsyncThunk } from "../types/CustomAsyncThunk";
import { error } from "@tauri-apps/plugin-log";
import { ErrorCode } from "../types/Error";

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
  async (
    { key, value }: { key: keyof Settings; value: Partial<Settings[keyof Settings]> },
    { getState, rejectWithValue },
  ) => {
    if (key === undefined) {
      const errorMessage = "Failed to updateSettings. Error: Key is undefined.";
      error(errorMessage);
      return rejectWithValue({ code: ErrorCode.SETTINGS_ERROR, message: errorMessage });
    }

    const target = getState().settings[key];

    if (typeof target === "object" && typeof value === "object") {
      const newValue: Settings[keyof Settings] = { ...target, ...value };
      await settingsStore.set(key, newValue);
      return { key, value: newValue };
    } else {
      await settingsStore.set(key, value);
      return { key, value: value as Settings[keyof Settings] };
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
     * @param state - The current Redux state slice.
     * @param action - Payload containing the complete Settings object.
     */
    setSettings: (state, action: PayloadAction<Settings>) => {
      return { ...state, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(
      updateSettings.fulfilled,
      (state, action: PayloadAction<{ key: keyof Settings; value: Settings[keyof Settings] }>) => {
        const { key, value } = action.payload;
        // Call the helper to bypass the union type assignment error.
        applySettingUpdate(state, key, value);
      },
    );
  },
});

/**
 * Helper to update state properties with strict type mapping.
 * * **Technical Reason:**
 * Generic `<K>` is used to re-establish the 1:1 relationship between
 * the key and its value type, bypassing 'never' type errors that occur
 * when indexing with broad union types like `keyof Settings`.
 */
const applySettingUpdate = <K extends keyof Settings>(
  state: Settings,
  key: K,
  value: Settings[K],
) => {
  state[key] = value;
};

export const { setSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
