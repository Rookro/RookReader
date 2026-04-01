import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useAppDispatch } from "../../../store/store";
import i18n from "../../../i18n/config";
import { setSettings } from "../slice";
import { loadAllSettings } from "../settingsStore";
import { SettingsChangedEvent } from "../../../types/SettingsChangedEvent";
import { useTauriEvent } from "../../../hooks/useTauriEvent";

/**
 * A custom hook that listens for settings change events from the settings window.
 *
 * The Redux store state is isolated within each WebView context.
 * Changes dispatched in the settings window will not be reflected in the main window's store.
 * This hook listens for the 'settings-changed' event, which is emitted by the settings window (SettingsApp),
 * and then dispatches the appropriate actions to apply the changes to the main window's Redux store.
 */
export const useSettingsChange = () => {
  const dispatch = useAppDispatch();

  /**
   * Handles the incoming 'settings-changed' event from Tauri.
   * It parses the payload and calls the appropriate function to apply the settings.
   * @param event The Tauri event object containing the settings payload.
   */
  const handleSettingsChanged = useCallback(
    async (event: { payload: SettingsChangedEvent }) => {
      debug(`Received settings changed event: ${JSON.stringify(event.payload)}`);

      if (event.payload.locale?.language !== undefined) {
        debug(`Received language changed event: ${event.payload.locale.language}`);
        i18n.changeLanguage(event.payload.locale.language);
      }

      const newSettings = await loadAllSettings();
      dispatch(setSettings(newSettings));
    },
    [dispatch],
  );

  useTauriEvent<SettingsChangedEvent>("settings-changed", handleSettingsChanged);
};
