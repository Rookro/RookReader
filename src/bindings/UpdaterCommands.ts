import { commands } from "./bindings";

/**
 * Checks if the auto-updater is supported on the current platform.
 *
 * @returns A promise that resolves to true if the updater is supported, false otherwise.
 */
export async function isUpdaterSupported(): Promise<boolean> {
  return await commands.isUpdaterSupported();
}
