import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** A settings error surfaced to the user (mirrors a `CommandError`'s code/message). */
export interface SettingsError {
  code: number;
  message?: string;
}

interface SettingsErrorState {
  /** The most recent unhandled settings error, or `null` once displayed. */
  error: SettingsError | null;
}

const initialState: SettingsErrorState = { error: null };

/**
 * Holds the latest settings-change failure so a window-level listener can show a
 * notification. The settings slice state itself is the `AppSettings` object and
 * has no room for an error field, so this lives in a dedicated slice.
 *
 * This slice is intentionally free of any reference to the `updateSettings`
 * thunk. The thunk itself dispatches `setSettingsError` from its failure path,
 * so the dependency is one-directional (`slice` → `errorSlice`); this slice
 * never imports the thunk. That avoids both an import cycle and the
 * module-initialization-order hazard an `extraReducers`/`addCase` on the
 * rejected thunk would otherwise risk.
 */
export const settingsErrorSlice = createSlice({
  name: "settingsError",
  initialState,
  reducers: {
    /** Records a settings error so a window-level listener can display it. */
    setSettingsError: (state, action: PayloadAction<SettingsError>) => {
      state.error = action.payload;
    },
    /** Clears the stored error after it has been shown to the user. */
    clearSettingsError: (state) => {
      state.error = null;
    },
  },
});

export const { setSettingsError, clearSettingsError } = settingsErrorSlice.actions;
export default settingsErrorSlice.reducer;
