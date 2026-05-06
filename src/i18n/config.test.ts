import { describe, expect, it } from "vitest";
import i18n from "./config";

describe("i18n configuration", () => {
  it("should be initialized with the correct resources", () => {
    // Check if en-US and ja-JP resources are loaded
    expect(i18n.hasResourceBundle("en-US", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("ja-JP", "translation")).toBe(true);
  });

  it("should have the correct fallback configuration", () => {
    const options = i18n.options;

    // In i18next, options.fallbackLng can be an object or array
    expect(options.fallbackLng).toEqual({
      en: ["en-US"],
      ja: ["ja-JP"],
      default: ["en-US"],
    });
  });

  it("should have interpolation.escapeValue set to false", () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  it("should be initialized", () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it("should translate keys correctly in en-US", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("book-reader.move-to-bookshelf")).toBe("Move to Bookshelf");
  });

  it("should translate keys correctly in ja-JP", async () => {
    await i18n.changeLanguage("ja-JP");
    expect(i18n.t("book-reader.move-to-bookshelf")).toBe("本棚画面に移動する");
  });

  it("should fallback to en-US for unknown languages", async () => {
    // Using a language not defined in resources
    await i18n.changeLanguage("fr");
    expect(i18n.t("book-reader.move-to-bookshelf")).toBe("Move to Bookshelf");
  });

  it("should use ja-JP when language is set to 'ja'", async () => {
    await i18n.changeLanguage("ja");
    expect(i18n.t("book-reader.move-to-bookshelf")).toBe("本棚画面に移動する");
  });
});
