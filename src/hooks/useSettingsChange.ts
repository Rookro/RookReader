import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import i18n from "../i18n/config";
import { useTauriEvent } from "./useTauriEvent";
import { useAppDispatch } from "../Store";
import { setIsFirstPageSingleView } from "../reducers/ViewReducer";
import { setIsHistoryEnabled } from "../reducers/HistoryReducer";
import {
  FileNavigatorSettings,
  HistorySettings,
  LocaleSettings,
  SettingsChangedEvent,
  ViewSettings,
} from "../types/SettingsChangedEvent";
import { setIsWatchEnabled as setIsDirWatchEnabled } from "../reducers/FileReducer";

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
   * Applies the locale settings by changing the i18n language.
   * @param settings The locale settings payload from the event.
   */
  const applyLocaleSettings = useCallback((settings: LocaleSettings) => {
    if (settings.language !== undefined) {
      debug(`Received language changed event: ${settings.language}`);
      i18n.changeLanguage(settings.language);
    }
  }, []);

  /**
   * Applies the view settings by dispatching an action to the ViewReducer.
   * @param settings The view settings payload from the event.
   */
  const applyViewSettings = useCallback(
    (settings: ViewSettings) => {
      if (settings.isFirstPageSingleView !== undefined) {
        debug(`Received isFirstPageSingleView changed event: ${settings.isFirstPageSingleView}`);
        dispatch(setIsFirstPageSingleView(settings.isFirstPageSingleView));
      }
    },
    [dispatch],
  );

  /**
   * Applies the history settings by dispatching an action to the HistoryReducer.
   * @param settings The history settings payload from the event.
   */
  const applyHistorySettings = useCallback(
    (settings: HistorySettings) => {
      if (settings.isEnabled !== undefined) {
        debug(`Received isHistoryEnabled changed event: ${settings.isEnabled}`);
        dispatch(setIsHistoryEnabled(settings.isEnabled));
      }
    },
    [dispatch],
  );

  /**
   * Applies the file navigator settings by dispatching an action to the FileReducer.
   * @param settings The file navigator settings payload from the event.
   */
  const applyFileNavigatorSettings = useCallback(
    (settings: FileNavigatorSettings) => {
      if (settings.isDirWatchEnabled !== undefined) {
        debug(`Received isDirWatchEnabled changed event: ${settings.isDirWatchEnabled}`);
        dispatch(setIsDirWatchEnabled(settings.isDirWatchEnabled));
      }
    },
    [dispatch],
  );

  /**
   * Handles the incoming 'settings-changed' event from Tauri.
   * It parses the payload and calls the appropriate function to apply the settings.
   * @param event The Tauri event object containing the settings payload.
   */
  const handleSettingsChanged = useCallback(
    (event: { payload: SettingsChangedEvent }) => {
      debug(`Received settings changed event: ${JSON.stringify(event.payload)}`);

      if (event.payload.locale !== undefined) {
        applyLocaleSettings(event.payload.locale);
      }
      if (event.payload.view !== undefined) {
        applyViewSettings(event.payload.view);
      }
      if (event.payload.history !== undefined) {
        applyHistorySettings(event.payload.history);
      }
      if (event.payload.fileNavigator !== undefined) {
        applyFileNavigatorSettings(event.payload.fileNavigator);
      }
    },
    [applyLocaleSettings, applyViewSettings, applyHistorySettings, applyFileNavigatorSettings],
  );

  useTauriEvent<SettingsChangedEvent>("settings-changed", handleSettingsChanged);
};
