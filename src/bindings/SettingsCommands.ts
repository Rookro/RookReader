import type { AppSettings } from "../types/AppSettings";
import { commands, type SettingsPatch } from "./bindings";
import { runCommand } from "./result";

/**
 * Loads the complete application settings from the backend.
 *
 * @returns The current application settings.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getSettings(): Promise<AppSettings> {
  // The backend always returns a complete settings object; the generated type marks
  // fields optional (container serde default), so assert the required-field shape.
  return (await runCommand(commands.getSettings())) as AppSettings;
}

/**
 * Applies a partial settings patch and returns the full merged settings.
 *
 * @param patch - The single-category partial change to apply.
 * @returns The full merged settings after persisting.
 * @throws {CommandError} If validation or persistence fails.
 */
export async function setSettings(patch: SettingsPatch): Promise<AppSettings> {
  return (await runCommand(commands.setSettings(patch))) as AppSettings;
}
