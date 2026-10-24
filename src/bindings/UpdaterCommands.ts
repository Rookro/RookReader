import { commands } from "./bindings";

/**
 * Checks if the auto-updater is supported on the current platform.
 *
 * @returns A promise that resolves to true if the updater is supported, false otherwise.
 */
export async function isUpdaterSupported(): Promise<boolean> {
  return await commands.isUpdaterSupported();
}

/**
 * Claims the update dialog for this window, so that only one window shows it.
 *
 * @returns A promise that resolves to true if this window may show the dialog, false if
 *   another window shows it.
 */
export async function claimUpdatePrompt(): Promise<boolean> {
  return await commands.claimUpdatePrompt();
}

/**
 * Releases the update dialog claimed by this window.
 *
 * @returns A promise that resolves once the backend has released it.
 */
export async function releaseUpdatePrompt(): Promise<void> {
  await commands.releaseUpdatePrompt();
}
