import { error } from "@tauri-apps/plugin-log";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError, ErrorCode } from "../../../types/Error";
import type { Image } from "../../../types/Image";
import { createImageCacheItem, fetchImageBlob, ImageCacheItem } from "./ImageUtils";
import { loadPageIntoCache, pagesToLoad } from "./pageLoading";

vi.mock("./ImageUtils", async (importActual) => ({
  ...(await importActual<typeof import("./ImageUtils")>()),
  fetchImageBlob: vi.fn(),
  fetchImagePreviewBlob: vi.fn(),
  createImageCacheItem: vi.fn(),
}));

const live = () => new AbortController().signal;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchImageBlob).mockResolvedValue({} as Image);
});

describe("pagesToLoad", () => {
  it("names the page and, in spread view, the one after it", () => {
    expect(pagesToLoad(["a", "b", "c"], 1, true)).toEqual(["b", "c"]);
    expect(pagesToLoad(["a", "b", "c"], 2, true)).toEqual(["c"]);
    expect(pagesToLoad(["a", "b", "c"], 0, false)).toEqual(["a"]);
  });
});

describe("loadPageIntoCache", () => {
  it("stores a loaded page and reports its shape", async () => {
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(200, 100, undefined, "f"));
    const cache = new Map<string, ImageCacheItem>();

    expect(await loadPageIntoCache(cache, "book", "a", false, live())).toEqual({
      status: "loaded",
      isLandscape: true,
    });
    expect(cache.get("a")?.fullUrl).toBe("f");
  });

  it("adds the full page to the entry its preview created", async () => {
    const cache = new Map([["a", new ImageCacheItem(200, 100, "p")]]);
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(100, 200, undefined, "f"));

    // The shape is the full page's, not the preview's the entry still carries.
    expect(await loadPageIntoCache(cache, "book", "a", false, live())).toEqual({
      status: "loaded",
      isLandscape: false,
    });
    expect(cache.get("a")?.previewUrl).toBe("p");
    expect(cache.get("a")?.fullUrl).toBe("f");
  });

  it("reports why a page failed", async () => {
    vi.mocked(fetchImageBlob).mockRejectedValue(new CommandError(ErrorCode.io, "x"));

    expect(await loadPageIntoCache(new Map(), "book", "a", false, live())).toEqual({
      status: "failed",
      code: ErrorCode.io,
    });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("loads nothing once aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const cache = new Map<string, ImageCacheItem>();

    expect(await loadPageIntoCache(cache, "book", "a", false, controller.signal)).toEqual({
      status: "skipped",
    });
    expect(fetchImageBlob).not.toHaveBeenCalled();
    expect(cache.size).toBe(0);
  });
});
