import { LazyStore } from "@tauri-apps/plugin-store";

const settingsFileName = import.meta.env.DEV
  ? "rook-reader_settings_dev.json"
  : "rook-reader_settings.json";

export const settingsStore = new LazyStore(settingsFileName);
