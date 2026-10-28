import type { EventCallback } from "@tauri-apps/api/event";
import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import {
  events,
  type LocaleChanged,
  type SettingsChanged_Serialize,
} from "../../../bindings/bindings";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import i18n from "../../../i18n/config";
import { useAppDispatch } from "../../../store/store";
import type { AppSettings } from "../../../types/AppSettings";
import { setPerfLogging } from "../../../utils/perf";
import { setSettings } from "../slice";

/**
 * Listens for cross-window settings/locale changes and applies them to this window's store.
 *
 * The Redux store is isolated per WebView. The backend broadcasts `settings-changed` (the
 * full `AppSettings`) on every `set_settings`, so this hook re-hydrates the slice directly
 * from the authoritative payload (no re-fetch). Application language is synced separately
 * via the frontend-only `locale-changed` event.
 */
export const useSettingsChange = () => {
  const dispatch = useAppDispatch();

  const handleSettingsChanged = useCallback<EventCallback<SettingsChanged_Serialize>>(
    (event) => {
      debug("Received settings-changed event");
      // The backend always sends the complete settings, as `getSettings` returns them.
      const settings = event.payload as AppSettings;
      // The perf flag is this window's own module state, and the records that read it —
      // the reader's `display` and `chain` spans — are written in the window that did not
      // make the change. The backend leaves the caller out of this broadcast, so for
      // every other window this event is the only thing that reaches it.
      setPerfLogging(settings.general.log.level);
      dispatch(setSettings(settings));
    },
    [dispatch],
  );

  const handleLocaleChanged = useCallback<EventCallback<LocaleChanged>>((event) => {
    debug(`Received locale-changed event: ${event.payload.language}`);
    i18n.changeLanguage(event.payload.language);
  }, []);

  useTauriEvent(events.settingsChanged, handleSettingsChanged);
  useTauriEvent(events.localeChanged, handleLocaleChanged);
};
