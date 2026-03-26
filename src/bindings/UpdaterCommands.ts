import { invoke } from "@tauri-apps/api/core";

/**
 * Checks if the auto-updater is supported on the current platform.
 *
 * @returns A promise that resolves to true if the updater is supported, false otherwise.
 */
export async function isUpdaterSupported(): Promise<boolean> {
  return await invoke("is_updater_supported");
}
