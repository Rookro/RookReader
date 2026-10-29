import type { AppSettings } from "../../types/AppSettings";
import type { SettingsFieldPath } from "./settingsFieldErrors";
import type { UpdateSettingsPayload } from "./slice";

/**
 * Reads the number a dotted settings path names.
 *
 * @param settings - The settings to read from.
 * @param path - The field's dotted path, e.g. `"reader.novel.fontSize"`.
 * @returns The field's value.
 * @throws {Error} If the path does not name a number, which no {@link SettingsFieldPath} does.
 */
export function settingAt(settings: AppSettings, path: SettingsFieldPath): number {
  let value: unknown = settings;
  for (const segment of path.split(".")) {
    value =
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[segment]
        : undefined;
  }
  if (typeof value !== "number") {
    throw new Error(`No number at settings path ${path}`);
  }
  return value;
}

/**
 * Builds the patch that sets the field a dotted settings path names, and nothing else.
 *
 * @param path - The field's dotted path, e.g. `"reader.novel.fontSize"`.
 * @param value - The field's new value.
 * @returns The payload for `updateSettings`.
 */
export function patchAt(path: SettingsFieldPath, value: number): UpdateSettingsPayload {
  const [key, ...rest] = path.split(".");
  const nested = rest.reduceRight<unknown>((inner, segment) => ({ [segment]: inner }), value);
  // The path is a generated bounds key, so it names a number leaf of `key`'s category.
  return { key, value: nested } as UpdateSettingsPayload;
}
