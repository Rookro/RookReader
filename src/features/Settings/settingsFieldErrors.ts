import type { TFunction } from "i18next";
import type { SettingsValidationViolation } from "../../bindings/bindings";

/**
 * Maps a backend violation `path` to the field's existing i18n title key, reused as the
 * human-readable field name in validation messages. Covers every free-typed numeric
 * setting; paths not listed here fall back to the raw path in {@link violationMessage}.
 */
const FIELD_LABEL_KEY = {
  "reader.rendering.maxImageHeight": "settings.rendering.resize.max-image-height.title",
  "reader.rendering.pdfRenderResolutionHeight": "settings.rendering.pdf.title",
  "reader.comic.cache.preloadPageCount": "settings.rendering.cache.preload-page-count.title",
  "reader.comic.cache.imageCacheSizeMib": "settings.rendering.cache.image-cache-size.title",
  "reader.novel.fontSize": "settings.reader.font-size.title",
  "reader.comic.loupe.zoom": "settings.reader.loupe.zoom",
  "reader.comic.loupe.radius": "settings.reader.loupe.radius",
} as const;

/** A settings field path that has an inline validation message. */
export type SettingsFieldPath = keyof typeof FIELD_LABEL_KEY;

/** Returns the violation for `path` from a rejected `updateSettings` payload, if any. */
export function findFieldViolation(
  details: SettingsValidationViolation[] | undefined,
  path: SettingsFieldPath,
): SettingsValidationViolation | undefined {
  return details?.find((violation) => violation.path === path);
}

/**
 * Builds a localized, field-specific message for a settings validation violation —
 * stating the kind of problem (range / whole-number / number) and, for range errors,
 * the valid bounds.
 *
 * @param t - The i18n translation function.
 * @param violation - The structured violation returned by the backend.
 * @returns A user-facing message in the active language.
 */
export function violationMessage(t: TFunction, violation: SettingsValidationViolation): string {
  const labelKey = FIELD_LABEL_KEY[violation.path as SettingsFieldPath];
  const field = labelKey ? t(labelKey) : violation.path;

  switch (violation.kind) {
    case "outOfRange":
      return t("error-message.settings.out-of-range", {
        field,
        min: violation.min ?? "",
        max: violation.max ?? "",
      });
    case "notInteger":
      return t("error-message.settings.not-integer", { field });
    default:
      return t("error-message.settings.invalid-number", { field });
  }
}
