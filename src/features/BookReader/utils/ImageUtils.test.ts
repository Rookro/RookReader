import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ContainerCommands from "../../../bindings/ContainerCommands";
import { Image } from "../../../types/Image";
import {
  calculateLayout,
  createImageCacheItem,
  fetchImageBlob,
  fetchImagePreviewBlob,
  findPreviousUnitStart,
  ImageCacheItem,
  type ViewerSettings,
} from "./ImageUtils";

describe("ImageUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  describe("ImageCacheItem", () => {
    // Verify that the url property returns fullUrl if the main image is available
    it("url should return fullUrl if available", () => {
      const item = new ImageCacheItem(100, 100, "preview", "full");
      expect(item.url).toBe("full");
    });

    // Verify that the url property returns previewUrl if fullUrl is missing
    it("url should return previewUrl if fullUrl is missing", () => {
      const item = new ImageCacheItem(100, 100, "preview", undefined);
      expect(item.url).toBe("preview");
    });
  });

  describe("calculateLayout", () => {
    const portrait = new ImageCacheItem(100, 200, "url1");
    const landscape = new ImageCacheItem(200, 100, "url2");
    const portraitNext = new ImageCacheItem(100, 200, "url3");

    const mockEntries = ["p1", "p2", "p3"];
    const cache = new Map<string, ImageCacheItem>();

    beforeEach(() => {
      cache.clear();
    });

    // Verify that layout calculation returns null if the first image is not in the cache
    it("should return null if first image is not in cache", () => {
      const settings: ViewerSettings = {
        isTwoPagedView: false,
        isFirstPageSingleView: false,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      expect(calculateLayout(0, mockEntries, cache, settings)).toBeNull();
    });

    // Verify that single page layout is returned when not in two-paged view mode
    it("should return single page layout if not in two-paged view", () => {
      cache.set("p1", portrait);
      const settings: ViewerSettings = {
        isTwoPagedView: false,
        isFirstPageSingleView: false,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      const layout = calculateLayout(0, mockEntries, cache, settings);
      expect(layout).toEqual({
        firstImage: portrait,
        isSpread: false,
        nextIndexIncrement: 1,
      });
    });

    // Verify that a single page layout is used if the first image is landscape, even in two-paged view mode
    it("should return single page if first image is landscape even in two-paged view", () => {
      cache.set("p1", landscape);
      cache.set("p2", portrait);
      const settings: ViewerSettings = {
        isTwoPagedView: true,
        isFirstPageSingleView: false,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      const layout = calculateLayout(0, mockEntries, cache, settings);
      expect(layout?.isSpread).toBe(false);
      expect(layout?.firstImage).toBe(landscape);
      expect(layout?.nextIndexIncrement).toBe(1);
    });

    // Verify that spread layout is used when two consecutive images are portraits in two-paged view mode
    it("should return spread if both are portraits in two-paged view", () => {
      cache.set("p1", portrait);
      cache.set("p2", portraitNext);
      const settings: ViewerSettings = {
        isTwoPagedView: true,
        isFirstPageSingleView: false,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      const layout = calculateLayout(0, mockEntries, cache, settings);
      expect(layout?.isSpread).toBe(true);
      expect(layout?.firstImage).toBe(portrait);
      expect(layout?.secondImage).toBe(portraitNext);
      expect(layout?.nextIndexIncrement).toBe(2);
    });

    // Verify that the first page is treated as a single page (not spread) if isFirstPageSingleView is enabled
    it("should return single page for first page if isFirstPageSingleView is true", () => {
      cache.set("p1", portrait);
      cache.set("p2", portraitNext);
      const settings: ViewerSettings = {
        isTwoPagedView: true,
        isFirstPageSingleView: true,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      const layout = calculateLayout(0, mockEntries, cache, settings);
      expect(layout?.isSpread).toBe(false);
      expect(layout?.nextIndexIncrement).toBe(1);
    });

    // Verify that spread layout is not used if the second image is landscape
    it("should return single page if second image is landscape", () => {
      cache.set("p1", portrait);
      cache.set("p2", landscape);
      const settings: ViewerSettings = {
        isTwoPagedView: true,
        isFirstPageSingleView: false,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      const layout = calculateLayout(0, mockEntries, cache, settings);
      expect(layout?.isSpread).toBe(false);
      expect(layout?.nextIndexIncrement).toBe(1);
    });

    // Verify that layout calculation returns null if the second image candidate for a spread is missing from the cache
    it("should return null if in two-paged view but second image is missing from cache", () => {
      cache.set("p1", portrait);
      const settings: ViewerSettings = {
        isTwoPagedView: true,
        isFirstPageSingleView: false,
        direction: "ltr",
        enablePreview: false,
        preloadPageCount: 10,
      };
      expect(calculateLayout(0, mockEntries, cache, settings)).toBeNull();
    });
  });

  describe("findPreviousUnitStart", () => {
    const portrait = () => new ImageCacheItem(100, 200, "url");
    const landscape = () => new ImageCacheItem(200, 100, "url");

    const twoPaged: ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    /** Builds entries + a cache from a list of "P"/"L" orientations. */
    const build = (orientations: ("P" | "L")[]) => {
      const entries = orientations.map((_, i) => `p${i}`);
      const cache = new Map<string, ImageCacheItem>();
      orientations.forEach((o, i) => {
        cache.set(`p${i}`, o === "P" ? portrait() : landscape());
      });
      return { entries, cache };
    };

    // Verify the previous unit start when a portrait page is single because its pair is landscape
    it("returns the single portrait unit before a landscape page (P,P,P,L)", () => {
      // units: {0,1} {2} {3}
      const { entries, cache } = build(["P", "P", "P", "L"]);
      expect(findPreviousUnitStart(3, entries, cache, twoPaged)).toBe(2);
    });

    // Verify stepping back from a landscape page lands on the start of the preceding spread
    it("returns the spread start before a single page (P,P,L)", () => {
      // units: {0,1} {2}
      const { entries, cache } = build(["P", "P", "L"]);
      expect(findPreviousUnitStart(2, entries, cache, twoPaged)).toBe(0);
    });

    // Verify even spreads are walked correctly
    it("returns the previous spread start in an all-portrait book", () => {
      // units: {0,1} {2,3} {4,5}
      const { entries, cache } = build(["P", "P", "P", "P", "P", "P"]);
      expect(findPreviousUnitStart(4, entries, cache, twoPaged)).toBe(2);
    });

    // Verify isFirstPageSingleView is honored by the walk
    it("honors isFirstPageSingleView", () => {
      // units: {0} {1,2} {3,4}
      const { entries, cache } = build(["P", "P", "P", "P", "P"]);
      const settings: ViewerSettings = { ...twoPaged, isFirstPageSingleView: true };
      expect(findPreviousUnitStart(3, entries, cache, settings)).toBe(1);
    });

    // Verify the walk bails out (null) when a page on the path is not cached
    it("returns null when a page dimension on the path is not cached", () => {
      const { entries, cache } = build(["P", "P", "P", "L"]);
      cache.delete("p1");
      expect(findPreviousUnitStart(3, entries, cache, twoPaged)).toBeNull();
    });

    // Verify the walk bails out (null) when currentIndex is not a real unit start
    it("returns null when currentIndex is mid-spread (overshoot)", () => {
      // units: {0,1} ...; index 1 is the second page of the first spread.
      const { entries, cache } = build(["P", "P", "P", "P"]);
      expect(findPreviousUnitStart(1, entries, cache, twoPaged)).toBeNull();
    });

    // Verify there is no previous unit at or before the first page
    it("returns null for the first page", () => {
      const { entries, cache } = build(["P", "P"]);
      expect(findPreviousUnitStart(0, entries, cache, twoPaged)).toBeNull();
    });
  });

  describe("fetchImageBlob", () => {
    // Verify that image acquisition returns undefined if the path is empty
    it("should return undefined if path is empty", async () => {
      expect(await fetchImageBlob("", "file")).toBeUndefined();
      expect(await fetchImageBlob("path", "")).toBeUndefined();
    });

    // Verify that an Image instance is correctly created on successful image acquisition
    it("should return fetched image on success", async () => {
      const width = 100;
      const height = 100;
      const data = new Uint8Array([1, 2, 3]);
      const buffer = new ArrayBuffer(4 + 4 + 4 + data.length);
      const view = new DataView(buffer);
      view.setUint32(0, width);
      view.setUint32(4, height);
      view.setUint32(8, data.length);
      new Uint8Array(buffer).set(data, 12);

      vi.mocked(ContainerCommands.getImage).mockResolvedValue(buffer);
      const result = await fetchImageBlob("path", "file");
      expect(result).toBeInstanceOf(Image);
      expect(result?.width).toBe(width);
    });

    // Verify that undefined is returned and an error log is output if getImage fails
    it("should return undefined and log error if getImage fails", async () => {
      vi.mocked(ContainerCommands.getImage).mockRejectedValue(new Error("fetch failed"));
      const result = await fetchImageBlob("path", "file");
      expect(result).toBeUndefined();
    });
  });

  describe("fetchImagePreviewBlob", () => {
    // Verify that preview image acquisition returns undefined if the path is empty
    it("should return undefined if path is empty", async () => {
      expect(await fetchImagePreviewBlob("", "file")).toBeUndefined();
      expect(await fetchImagePreviewBlob("path", "")).toBeUndefined();
    });

    // Verify that an Image instance is correctly created on successful preview image acquisition
    it("should return fetched image on success", async () => {
      const width = 50;
      const height = 50;
      const data = new Uint8Array([1, 2, 3]);
      const buffer = new ArrayBuffer(4 + 4 + 4 + data.length);
      const view = new DataView(buffer);
      view.setUint32(0, width);
      view.setUint32(4, height);
      view.setUint32(8, data.length);
      new Uint8Array(buffer).set(data, 12);

      vi.mocked(ContainerCommands.getImagePreview).mockResolvedValue(buffer);
      const result = await fetchImagePreviewBlob("path", "file");
      expect(result).toBeInstanceOf(Image);
      expect(result?.width).toBe(50);
    });

    // Verify that undefined is returned for empty responses to skip preview display
    it("should return undefined if response is empty (skip preview)", async () => {
      const buffer = new ArrayBuffer(0);
      vi.mocked(ContainerCommands.getImagePreview).mockResolvedValue(buffer);
      const result = await fetchImagePreviewBlob("path", "file");
      expect(result).toBeUndefined();
    });

    // Verify that undefined is returned and an error log is output if getImagePreview fails
    it("should return undefined and log error if getImagePreview fails", async () => {
      vi.mocked(ContainerCommands.getImagePreview).mockRejectedValue(new Error("preview failed"));
      const result = await fetchImagePreviewBlob("path", "file");
      expect(result).toBeUndefined();
    });
  });

  describe("createImageCacheItem", () => {
    // Verify that a cache item is correctly created with fullUrl from a non-preview image
    it("should create cache item with fullUrl for non-preview", () => {
      const buffer = new ArrayBuffer(12 + 1);
      new DataView(buffer).setUint32(0, 100);
      new DataView(buffer).setUint32(4, 100);
      new DataView(buffer).setUint32(8, 1);
      const image = new Image(buffer);
      const item = createImageCacheItem(image, false);
      expect(item.fullUrl).toBe("mock-url");
      expect(item.previewUrl).toBeUndefined();
    });

    // Verify that a cache item is correctly created with previewUrl from a preview image
    it("should create cache item with previewUrl for preview", () => {
      const buffer = new ArrayBuffer(12 + 1);
      new DataView(buffer).setUint32(0, 50);
      new DataView(buffer).setUint32(4, 50);
      new DataView(buffer).setUint32(8, 1);
      const image = new Image(buffer);
      const item = createImageCacheItem(image, true);
      expect(item.previewUrl).toBe("mock-url");
      expect(item.fullUrl).toBeUndefined();
    });
  });
});
