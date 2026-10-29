import { describe, expect, it } from "vitest";
import { patchAt, settingAt } from "./settingsPath";
import { defaultSettings } from "./settingsStore";

describe("settingAt", () => {
  it("reads every field's default", () => {
    const { cache, loupe } = defaultSettings.reader.comic;
    const { rendering, novel } = defaultSettings.reader;
    expect(settingAt(defaultSettings, "reader.comic.cache.preloadPageCount")).toBe(
      cache.preloadPageCount,
    );
    expect(settingAt(defaultSettings, "reader.comic.cache.pageReaderCount")).toBe(
      cache.pageReaderCount,
    );
    expect(settingAt(defaultSettings, "reader.comic.cache.imageCacheSizeMib")).toBe(
      cache.imageCacheSizeMib,
    );
    expect(settingAt(defaultSettings, "reader.rendering.maxImageHeight")).toBe(
      rendering.maxImageHeight,
    );
    expect(settingAt(defaultSettings, "reader.rendering.pdfRenderResolutionHeight")).toBe(
      rendering.pdfRenderResolutionHeight,
    );
    expect(settingAt(defaultSettings, "reader.novel.fontSize")).toBe(novel.fontSize);
    expect(settingAt(defaultSettings, "reader.comic.loupe.zoom")).toBe(loupe.zoom);
    expect(settingAt(defaultSettings, "reader.comic.loupe.radius")).toBe(loupe.radius);
  });
});

describe("patchAt", () => {
  it("builds the one-leaf patch for a path", () => {
    expect(patchAt("reader.comic.cache.preloadPageCount", 5)).toEqual({
      key: "reader",
      value: { comic: { cache: { preloadPageCount: 5 } } },
    });
  });
});
