import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ContainerCommands from "../../../bindings/ContainerCommands";
import { Image } from "../../../types/Image";
import {
  buildUnitChain,
  buildUnitLayout,
  createImageCacheItem,
  fetchImageBlob,
  fetchImagePreviewBlob,
  findPreviousUnitStart,
  ImageCacheItem,
  type PageDims,
  resolveUnit,
  type ViewerSettings,
} from "./ImageUtils";

/** Builds entries plus a dimensions lookup from a list of "P"/"L" orientations. */
const buildDims = (orientations: ("P" | "L")[]) => {
  const entries = orientations.map((_, i) => `p${i}`);
  const dims = new Map<number, PageDims>();
  orientations.forEach((o, i) => {
    dims.set(i, o === "P" ? { width: 100, height: 200 } : { width: 200, height: 100 });
  });
  return { entries, dims, getDims: (i: number) => dims.get(i) };
};

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

  describe("resolveUnit", () => {
    const twoPaged: ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    // Verify that two portrait pages are paired into a spread
    it("returns a spread for two portrait pages", () => {
      const { entries, getDims } = buildDims(["P", "P"]);
      expect(resolveUnit(0, entries, getDims, twoPaged)).toEqual({
        isSpread: true,
        nextIndexIncrement: 2,
      });
    });

    // Verify that a landscape page occupies a unit on its own
    it("returns a single unit for a landscape first page", () => {
      const { entries, getDims } = buildDims(["L", "P"]);
      expect(resolveUnit(0, entries, getDims, twoPaged)).toEqual({
        isSpread: false,
        nextIndexIncrement: 1,
      });
    });

    // Verify that a portrait page followed by a landscape page is shown alone
    it("returns a single unit when the second page is landscape", () => {
      const { entries, getDims } = buildDims(["P", "L"]);
      expect(resolveUnit(0, entries, getDims, twoPaged)).toEqual({
        isSpread: false,
        nextIndexIncrement: 1,
      });
    });

    // Verify that the last page is never paired
    it("returns a single unit for the last page", () => {
      const { entries, getDims } = buildDims(["P", "P"]);
      expect(resolveUnit(1, entries, getDims, twoPaged)).toEqual({
        isSpread: false,
        nextIndexIncrement: 1,
      });
    });

    // Verify that spread mode being off always yields single units
    it("returns a single unit when two-paged view is off", () => {
      const { entries, getDims } = buildDims(["P", "P"]);
      expect(resolveUnit(0, entries, getDims, { ...twoPaged, isTwoPagedView: false })).toEqual({
        isSpread: false,
        nextIndexIncrement: 1,
      });
    });

    // Verify that the cover is shown alone when isFirstPageSingleView is enabled
    it("returns a single unit for page 0 when isFirstPageSingleView is on", () => {
      const { entries, getDims } = buildDims(["P", "P"]);
      expect(
        resolveUnit(0, entries, getDims, { ...twoPaged, isFirstPageSingleView: true }),
      ).toEqual({ isSpread: false, nextIndexIncrement: 1 });
    });

    // Verify that an unknown dimension prevents a partial decision
    it("returns null when a needed dimension is unknown", () => {
      const { entries, dims } = buildDims(["P", "P"]);
      dims.delete(1);
      expect(resolveUnit(0, entries, (i) => dims.get(i), twoPaged)).toBeNull();
    });
  });

  describe("buildUnitLayout", () => {
    const portrait = new ImageCacheItem(100, 200, "url1");
    const portraitNext = new ImageCacheItem(100, 200, "url2");
    const entries = ["p0", "p1"];

    // Verify that a spread decision attaches both images
    it("attaches both images for a spread", () => {
      const cache = new Map([
        ["p0", portrait],
        ["p1", portraitNext],
      ]);
      expect(buildUnitLayout({ isSpread: true, nextIndexIncrement: 2 }, 0, entries, cache)).toEqual(
        {
          firstImage: portrait,
          secondImage: portraitNext,
          isSpread: true,
          nextIndexIncrement: 2,
        },
      );
    });

    // Verify that a spread decision fails when the second image is not loaded yet
    it("returns null when the spread's second image is not cached", () => {
      const cache = new Map([["p0", portrait]]);
      expect(
        buildUnitLayout({ isSpread: true, nextIndexIncrement: 2 }, 0, entries, cache),
      ).toBeNull();
    });

    // Verify that a single-page decision only needs the first image
    it("attaches only the first image for a single unit", () => {
      const cache = new Map([["p0", portrait]]);
      expect(
        buildUnitLayout({ isSpread: false, nextIndexIncrement: 1 }, 0, entries, cache),
      ).toEqual({ firstImage: portrait, isSpread: false, nextIndexIncrement: 1 });
    });
  });

  describe("buildUnitChain", () => {
    const twoPaged: ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    // Verify the forward walk pairs portraits and leaves a portrait before a landscape alone
    it("lays out units forward from the anchor", () => {
      const { entries, getDims } = buildDims(["P", "P", "P", "L", "P", "P"]);
      const chain = buildUnitChain(0, entries, getDims, twoPaged);

      // {0,1} {2} {3} {4,5}
      expect(chain.starts).toEqual([0, 2, 3, 4]);
      expect(chain.units.get(0)).toEqual({ isSpread: true, nextIndexIncrement: 2 });
      expect(chain.units.get(2)).toEqual({ isSpread: false, nextIndexIncrement: 1 });
      expect(chain.units.get(3)).toEqual({ isSpread: false, nextIndexIncrement: 1 });
      expect(chain.units.get(4)).toEqual({ isSpread: true, nextIndexIncrement: 2 });
    });

    // Verify the anchor always starts its own unit and the pages before it are still covered
    it("treats the anchor as a unit start and pairs backward from it", () => {
      const { entries, getDims } = buildDims(["P", "P", "P", "P", "P"]);
      const chain = buildUnitChain(3, entries, getDims, twoPaged);

      // {0} {1,2} {3,4} - page 3 is a unit start because that is where the reader landed.
      expect(chain.starts).toEqual([0, 1, 3]);
      expect(chain.units.get(1)).toEqual({ isSpread: true, nextIndexIncrement: 2 });
      expect(chain.units.get(3)).toEqual({ isSpread: true, nextIndexIncrement: 2 });
    });

    // Verify a landscape page is never paired when walking backward
    it("does not pair a landscape page when walking backward", () => {
      const { entries, getDims } = buildDims(["P", "L", "P", "P"]);
      const chain = buildUnitChain(2, entries, getDims, twoPaged);

      // {0} {1} {2,3}
      expect(chain.starts).toEqual([0, 1, 2]);
      expect(chain.units.get(1)).toEqual({ isSpread: false, nextIndexIncrement: 1 });
    });

    // Verify the cover stays alone in both directions when isFirstPageSingleView is on
    it("keeps page 0 alone when isFirstPageSingleView is on", () => {
      const settings: ViewerSettings = { ...twoPaged, isFirstPageSingleView: true };
      const { entries, getDims } = buildDims(["P", "P", "P", "P", "P"]);

      expect(buildUnitChain(0, entries, getDims, settings).starts).toEqual([0, 1, 3]);
      // Anchored mid-book, the backward walk must not pair page 0 with page 1 either.
      expect(buildUnitChain(3, entries, getDims, settings).starts).toEqual([0, 1, 3]);
    });

    // Verify every page belongs to exactly one unit, so no page is unreachable
    it("covers every page exactly once", () => {
      const { entries, getDims } = buildDims(["P", "P", "L", "P", "P", "P", "L"]);
      const chain = buildUnitChain(4, entries, getDims, twoPaged);

      const covered = chain.starts.flatMap((start) => {
        const unit = chain.units.get(start);
        return unit?.isSpread ? [start, start + 1] : [start];
      });
      expect(covered).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    // Verify single-page mode never produces a spread
    it("produces only single units when two-paged view is off", () => {
      const { entries, getDims } = buildDims(["P", "P", "P"]);
      const chain = buildUnitChain(2, entries, getDims, { ...twoPaged, isTwoPagedView: false });

      expect(chain.starts).toEqual([0, 1, 2]);
      expect(chain.starts.every((s) => chain.units.get(s)?.isSpread === false)).toBe(true);
    });
  });

  describe("findPreviousUnitStart", () => {
    const twoPaged: ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    // Verify the previous unit start when a portrait page is single because its pair is landscape
    it("returns the single portrait unit before a landscape page (P,P,P,L)", () => {
      // units: {0,1} {2} {3}
      const { entries, getDims } = buildDims(["P", "P", "P", "L"]);
      expect(findPreviousUnitStart(3, entries, getDims, twoPaged)).toBe(2);
    });

    // Verify stepping back from a landscape page lands on the start of the preceding spread
    it("returns the spread start before a single page (P,P,L)", () => {
      // units: {0,1} {2}
      const { entries, getDims } = buildDims(["P", "P", "L"]);
      expect(findPreviousUnitStart(2, entries, getDims, twoPaged)).toBe(0);
    });

    // Verify even spreads are walked correctly
    it("returns the previous spread start in an all-portrait book", () => {
      // units: {0,1} {2,3} {4,5}
      const { entries, getDims } = buildDims(["P", "P", "P", "P", "P", "P"]);
      expect(findPreviousUnitStart(4, entries, getDims, twoPaged)).toBe(2);
    });

    // Verify isFirstPageSingleView is honored by the walk
    it("honors isFirstPageSingleView", () => {
      // units: {0} {1,2} {3,4}
      const { entries, getDims } = buildDims(["P", "P", "P", "P", "P"]);
      const settings: ViewerSettings = { ...twoPaged, isFirstPageSingleView: true };
      expect(findPreviousUnitStart(3, entries, getDims, settings)).toBe(1);
    });

    // Verify the walk bails out (null) when a page on the path has unknown dimensions
    it("returns null when a page dimension on the path is unknown", () => {
      const { entries, dims } = buildDims(["P", "P", "P", "L"]);
      dims.delete(1);
      expect(findPreviousUnitStart(3, entries, (i) => dims.get(i), twoPaged)).toBeNull();
    });

    // Verify the walk bails out (null) when currentIndex is not a real unit start
    it("returns null when currentIndex is mid-spread (overshoot)", () => {
      // units: {0,1} ...; index 1 is the second page of the first spread.
      const { entries, getDims } = buildDims(["P", "P", "P", "P"]);
      expect(findPreviousUnitStart(1, entries, getDims, twoPaged)).toBeNull();
    });

    // Verify there is no previous unit at or before the first page
    it("returns null for the first page", () => {
      const { entries, getDims } = buildDims(["P", "P"]);
      expect(findPreviousUnitStart(0, entries, getDims, twoPaged)).toBeNull();
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
