import { beforeAll, describe, expect, it } from "vitest";
import type { SettingsValidationViolation } from "../../bindings/bindings";
import i18n from "../../i18n/config";
import {
  findFieldViolation,
  type SettingsFieldPath,
  violationMessage,
} from "./settingsFieldErrors";

/** The free-typed numeric fields that surface inline validation messages. */
const FIELD_PATHS: SettingsFieldPath[] = [
  "reader.rendering.maxImageHeight",
  "reader.rendering.pdfRenderResolutionHeight",
  "reader.comic.cache.preloadPageCount",
  "reader.comic.cache.imageCacheSizeMib",
  "reader.novel.fontSize",
  "reader.comic.loupe.zoom",
  "reader.comic.loupe.radius",
];

const violation = (
  partial: Partial<SettingsValidationViolation> & Pick<SettingsValidationViolation, "kind">,
): SettingsValidationViolation => ({
  path: "reader.rendering.maxImageHeight",
  min: 0,
  max: 65535,
  ...partial,
});

describe("settingsFieldErrors", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en-US");
  });

  describe("violationMessage", () => {
    it("states the field name and the valid range for an out-of-range value", () => {
      const message = violationMessage(
        i18n.t,
        violation({ kind: "outOfRange", min: 0, max: 65535 }),
      );
      expect(message).toContain("Maximum image Height(px)");
      expect(message).toContain("0");
      expect(message).toContain("65535");
    });

    it("asks for a whole number for a non-integer value", () => {
      const message = violationMessage(i18n.t, violation({ kind: "notInteger" }));
      expect(message).toMatch(/whole number/i);
    });

    it("asks for a valid number for a non-numeric value", () => {
      const message = violationMessage(i18n.t, violation({ kind: "notANumber" }));
      expect(message).toMatch(/valid number/i);
    });

    it("resolves a human-readable field name (not the raw path) for every field", () => {
      for (const path of FIELD_PATHS) {
        const message = violationMessage(i18n.t, violation({ path, kind: "notInteger" }));
        expect(message).not.toContain(path);
      }
    });
  });

  describe("findFieldViolation", () => {
    it("returns the violation matching the path", () => {
      const details: SettingsValidationViolation[] = [
        violation({ path: "reader.comic.loupe.zoom", kind: "outOfRange", min: 1, max: 100 }),
      ];
      expect(findFieldViolation(details, "reader.comic.loupe.zoom")?.kind).toBe("outOfRange");
    });

    it("returns undefined when no violation matches or details are absent", () => {
      const details: SettingsValidationViolation[] = [
        violation({ path: "reader.comic.loupe.zoom", kind: "outOfRange" }),
      ];
      expect(findFieldViolation(details, "reader.novel.fontSize")).toBeUndefined();
      expect(findFieldViolation(undefined, "reader.novel.fontSize")).toBeUndefined();
    });
  });
});
