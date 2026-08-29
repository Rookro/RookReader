import { describe, expect, it } from "vitest";
import i18n from "./config";
import translationEnUs from "./locales/en-US.json";
import translationJaJp from "./locales/ja-JP.json";

const flatten = (value: unknown, prefix = "", out: Record<string, string> = {}) => {
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "object" && child !== null) {
      flatten(child, path, out);
    } else {
      out[path] = String(child);
    }
  }
  return out;
};

const placeholdersOf = (value: string) =>
  [...value.matchAll(/{{(.*?)}}/g)].map((match) => match[1].trim()).sort();

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

describe("i18n resources", () => {
  it("should define exactly the same keys in en-US and ja-JP", () => {
    const enKeys = Object.keys(flatten(translationEnUs)).sort();
    const jaKeys = Object.keys(flatten(translationJaJp)).sort();
    expect(jaKeys).toEqual(enKeys);
  });

  it("should use the same interpolation placeholders in both locales", () => {
    const en = flatten(translationEnUs);
    const ja = flatten(translationJaJp);

    for (const [key, value] of Object.entries(en)) {
      expect(placeholdersOf(ja[key]), `placeholders differ for "${key}"`).toEqual(
        placeholdersOf(value),
      );
    }
  });

  it("should not leave a translation empty", () => {
    for (const [key, value] of Object.entries(flatten(translationEnUs))) {
      expect(value.trim(), `"${key}" is empty in en-US`).not.toBe("");
    }
    for (const [key, value] of Object.entries(flatten(translationJaJp))) {
      expect(value.trim(), `"${key}" is empty in ja-JP`).not.toBe("");
    }
  });
});
