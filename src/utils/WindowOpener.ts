import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { error } from "@tauri-apps/plugin-log";

/**
 * Opens the settings window, or brings it to the front if it is already open.
 *
 * @param title - Localized title shown in the window's title bar.
 */
export async function openSettingsWindow(title: string): Promise<void> {
  try {
    const existing = await WebviewWindow.getByLabel("settings");
    if (existing) {
      await existing.unminimize();
      await existing.setFocus();
      return;
    }
  } catch (e) {
    error(`Failed to bring the settings window to the front: ${e}`);
    return;
  }

  const settingsWindow = new WebviewWindow("settings", {
    url: "/#/settings",
    title,
    parent: "main",
    width: 940,
    height: 450,
    resizable: true,
    center: true,
  });
  // Creation failures arrive as this event; the constructor itself never throws.
  void settingsWindow.once("tauri://error", (event) => {
    error(`Failed to open the settings window: ${JSON.stringify(event.payload)}`);
  });
}
