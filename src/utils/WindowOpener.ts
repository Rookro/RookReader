import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { error } from "@tauri-apps/plugin-log";

/**
 * Opens the settings window.
 */
export function openSettingsWindow() {
  try {
    const settingsWindow = new WebviewWindow("settings", {
      url: "/#/settings",
      title: "Settings",
      parent: "main",
      width: 940,
      height: 450,
      resizable: true,
      center: true,
    });

    return settingsWindow;
  } catch (ex) {
    error(`Failed to open settings window. ${JSON.stringify(ex)}`);
  }
}
