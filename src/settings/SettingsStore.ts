import { LazyStore } from "@tauri-apps/plugin-store";

export const settingsStore = new LazyStore("rook-reader_settings.json");
