import { error } from "@tauri-apps/plugin-log";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError, ErrorCode } from "../../../types/Error";
import type { Image } from "../../../types/Image";
import {
  createImageCacheItem,
  fetchImageBlob,
  fetchImagePreviewBlob,
  ImageCacheItem,
} from "./ImageUtils";
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
  vi.mocked(fetchImagePreviewBlob).mockResolvedValue({} as Image);
});

afterEach(() => {
  vi.restoreAllMocks();
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

    expect(await loadPageIntoCache(cache, "book", "a", false, 1, live())).toEqual({
      status: "loaded",
      isLandscape: true,
    });
    expect(cache.get("a")?.fullUrl).toBe("f");
  });

  it("passes the generation to the fetch", async () => {
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(200, 100, undefined, "f"));
    const cache = new Map<string, ImageCacheItem>();

    await loadPageIntoCache(cache, "book", "a", false, 7, live());
    expect(fetchImageBlob).toHaveBeenCalledWith("book", "a", 7);
  });

  it("adds the full page to the entry its preview created", async () => {
    const cache = new Map([["a", new ImageCacheItem(200, 100, "p")]]);
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(100, 200, undefined, "f"));

    // The shape is the full page's, not the preview's the entry still carries.
    expect(await loadPageIntoCache(cache, "book", "a", false, 1, live())).toEqual({
      status: "loaded",
      isLandscape: false,
    });
    expect(cache.get("a")?.previewUrl).toBe("p");
    expect(cache.get("a")?.fullUrl).toBe("f");
  });

  it("reports why a page failed", async () => {
    vi.mocked(fetchImageBlob).mockRejectedValue(new CommandError(ErrorCode.io, "x"));

    expect(await loadPageIntoCache(new Map(), "book", "a", false, 1, live())).toEqual({
      status: "failed",
      code: ErrorCode.io,
    });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("logs nothing for a load that failed after it was aborted", async () => {
    const controller = new AbortController();
    vi.mocked(fetchImageBlob).mockImplementation(async () => {
      controller.abort();
      throw new CommandError(ErrorCode.requestCancelled, "x");
    });

    expect(await loadPageIntoCache(new Map(), "book", "a", false, 7, controller.signal)).toEqual({
      status: "skipped",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("loads nothing once aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const cache = new Map<string, ImageCacheItem>();

    expect(await loadPageIntoCache(cache, "book", "a", false, 1, controller.signal)).toEqual({
      status: "skipped",
    });
    expect(fetchImageBlob).not.toHaveBeenCalled();
    expect(cache.size).toBe(0);
  });

  /** Holds every image decode until `release`; `fail` rejects them instead. */
  const holdDecode = () => {
    let release: () => void = () => {};
    let fail: () => void = () => {};
    const held = new Promise<void>((resolve, reject) => {
      release = resolve;
      fail = () => reject(new DOMException("x", "EncodingError"));
    });
    const spy = vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(held);
    return { release, fail, spy };
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("stores the page only once its decode has resolved", async () => {
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(100, 200, undefined, "f"));
    const decode = holdDecode();
    const cache = new Map<string, ImageCacheItem>();

    const load = loadPageIntoCache(cache, "book", "a", false, 1, live());
    await flush();
    expect(decode.spy).toHaveBeenCalledTimes(1);
    expect(cache.has("a")).toBe(false);

    decode.release();
    expect(await load).toEqual({ status: "loaded", isLandscape: false });
    expect(cache.get("a")?.decoded?.getAttribute("src")).toBe("f");
  });

  it("stores a page whose decode failed, logging nothing", async () => {
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(100, 200, undefined, "f"));
    const decode = holdDecode();
    const cache = new Map<string, ImageCacheItem>();

    const load = loadPageIntoCache(cache, "book", "a", false, 1, live());
    await flush();
    decode.fail();

    expect(await load).toEqual({ status: "loaded", isLandscape: false });
    expect(decode.spy).toHaveBeenCalledTimes(1);
    expect(cache.get("a")?.fullUrl).toBe("f");
    expect(cache.get("a")?.decoded).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  it("stores nothing for a load aborted during its decode, and revokes its URL", async () => {
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(100, 200, undefined, "f"));
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const decode = holdDecode();
    const controller = new AbortController();
    const cache = new Map<string, ImageCacheItem>();

    const load = loadPageIntoCache(cache, "book", "a", false, 1, controller.signal);
    await flush();
    controller.abort();
    decode.release();

    expect(await load).toEqual({ status: "skipped" });
    expect(cache.has("a")).toBe(false);
    expect(revoke).toHaveBeenCalledWith("f");
  });

  it("replaces the preview's decoded image with the full page's", async () => {
    const preview = new ImageCacheItem(200, 100, "p");
    preview.decoded = document.createElement("img");
    const cache = new Map([["a", preview]]);
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(100, 200, undefined, "f"));

    await loadPageIntoCache(cache, "book", "a", false, 1, live());
    expect(cache.get("a")?.decoded?.getAttribute("src")).toBe("f");
  });

  // Guard at run time (it only fails to type-check on the old code): pins that the new
  // decode skips a preview that can never be displayed.
  it("does not decode a preview that arrives after its full page", async () => {
    const full = new ImageCacheItem(100, 200, undefined, "f");
    const decodedFull = document.createElement("img");
    full.decoded = decodedFull;
    const cache = new Map([["a", full]]);
    vi.mocked(createImageCacheItem).mockReturnValue(new ImageCacheItem(50, 100, "p"));
    const decode = vi.spyOn(HTMLImageElement.prototype, "decode");

    await loadPageIntoCache(cache, "book", "a", true, 1, live());
    expect(decode).not.toHaveBeenCalled();
    expect(cache.get("a")?.previewUrl).toBe("p");
    expect(cache.get("a")?.decoded).toBe(decodedFull);
  });
});
