import { debug } from "@tauri-apps/plugin-log";
import { useCallback } from "react";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import i18n from "../../../i18n/config";
import { useAppDispatch } from "../../../store/store";
import type { AppSettings } from "../../../types/AppSettings";
import type { LocaleChangedEvent } from "../../../types/LocaleChangedEvent";
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

  const handleSettingsChanged = useCallback(
    (event: { payload: AppSettings }) => {
      debug("Received settings-changed event");
      dispatch(setSettings(event.payload));
    },
    [dispatch],
  );

  const handleLocaleChanged = useCallback((event: { payload: LocaleChangedEvent }) => {
    debug(`Received locale-changed event: ${event.payload.language}`);
    i18n.changeLanguage(event.payload.language);
  }, []);

  useTauriEvent<AppSettings>("settings-changed", handleSettingsChanged);
  useTauriEvent<LocaleChangedEvent>("locale-changed", handleLocaleChanged);
};
