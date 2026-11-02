import { describe, expect, it } from "vitest";
import { SETTINGS_BOUNDS } from "./settingsBounds";

describe("SETTINGS_BOUNDS", () => {
  it("holds the backend's bounds for each validated setting", () => {
    expect(SETTINGS_BOUNDS["reader.comic.cache.imageCacheSizeMib"]).toEqual({
      integer: true,
      min: 1,
      max: 65536,
    });
  });

  it("only accepts the paths of validated settings", () => {
    // @ts-expect-error A path that is not a bounded setting does not compile.
    expect(SETTINGS_BOUNDS["reader.comic.cache.preloadPageCnt"]).toBeUndefined();
  });
});
