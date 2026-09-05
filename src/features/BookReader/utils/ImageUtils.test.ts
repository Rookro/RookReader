import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ContainerCommands from "../../../bindings/ContainerCommands";
import { CommandError, ErrorCode } from "../../../types/Error";
import { Image } from "../../../types/Image";
import {
  buildUnitChain,
  buildUnitLayout,
  createImageCacheItem,
  detectCoverPresence,
  fetchImageBlob,
  fetchImagePreviewBlob,
  ImageCacheItem,
  type ViewerSettings,
} from "./ImageUtils";

/** Builds entries and the landscape bits from a list of "P"/"L" orientations. */
const buildDims = (orientations: ("P" | "L")[]) => {
  const entries = orientations.map((_, i) => `p${i}`);
  const pages: boolean[] = orientations.map((o) => o === "L");
  return { entries, pages };
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

  describe("detectCoverPresence", () => {
    // Verify an archive with no landscape page offers nothing to go on
    it("returns null when the archive has no landscape page", () => {
      const { pages } = buildDims(["P", "P", "P", "P"]);
      expect(detectCoverPresence(pages)).toBeNull();
    });

    // Verify one page before a landscape page proves the first image is page 1
    it("detects a cover when one page precedes the landscape page", () => {
      const { pages } = buildDims(["P", "L", "P", "P"]);
      expect(detectCoverPresence(pages)).toBe(true);
    });

    // Verify a landscape first image cannot be page 1, so the archive has no cover
    it("detects no cover when the archive opens on a landscape page", () => {
      const { pages } = buildDims(["L", "P", "P"]);
      expect(detectCoverPresence(pages)).toBe(false);
    });

    // Verify a landscape page counts as two pages when locating the next one
    it("counts a landscape page as two pages when checking the next one", () => {
      // Pages before the second landscape: P(1) + L(2) + P(1) + P(1) = 5, odd, so both agree.
      const { pages } = buildDims(["P", "L", "P", "P", "L", "P"]);
      expect(detectCoverPresence(pages)).toBe(true);
    });

    // Verify landscape pages that disagree prove a missing page, so detection gives up
    it("returns null when two landscape pages disagree", () => {
      // Pages before the second landscape: P(1) + L(2) + P(1) = 4, even, contradicting the first.
      const { pages } = buildDims(["P", "L", "P", "L", "P"]);
      expect(detectCoverPresence(pages)).toBeNull();
    });

    // Verify an empty book offers no evidence either
    it("returns null for an empty book", () => {
      expect(detectCoverPresence([])).toBeNull();
    });
  });

  describe("the evidence order for hasCover", () => {
    const twoPaged: ViewerSettings = {
      isTwoPagedView: true,
      isFirstPageSingleView: false,
      direction: "ltr",
      enablePreview: false,
      preloadPageCount: 10,
    };

    /**
     * How the viewer decides `hasCover`, in the order the evidence ranks: the reader's
     * persisted correction, then the archive's landscape pages, then the setting.
     */
    const hasCover = (landscape: boolean[], settings: ViewerSettings, shifted: boolean) => {
      const base = detectCoverPresence(landscape) ?? settings.isFirstPageSingleView;
      return shifted ? !base : base;
    };

    // Verify a landscape page outranks the configured default
    it("lets a landscape page settle the parity against the setting", () => {
      // A landscape page at index 1 has one page before it, so the first image is the
      // cover — the opposite of what isFirstPageSingleView says here.
      const { pages } = buildDims(["P", "L", "P"]);
      expect(detectCoverPresence(pages)).toBe(true);
      expect(hasCover(pages, { ...twoPaged, isFirstPageSingleView: false }, false)).toBe(true);
    });

    // Verify the setting decides only when the archive offers no proof
    it("falls back to the setting when no page is landscape", () => {
      const { pages } = buildDims(["P", "P", "P"]);
      expect(detectCoverPresence(pages)).toBeNull();
      expect(hasCover(pages, { ...twoPaged, isFirstPageSingleView: true }, false)).toBe(true);
      expect(hasCover(pages, { ...twoPaged, isFirstPageSingleView: false }, false)).toBe(false);
    });

    // Verify the reader's correction outranks both, so the button always changes something
    it("flips whichever of the two decided", () => {
      const proven = buildDims(["P", "L", "P"]).pages;
      const unproven = buildDims(["P", "P", "P"]).pages;

      expect(hasCover(proven, twoPaged, true)).toBe(!hasCover(proven, twoPaged, false));
      expect(hasCover(unproven, twoPaged, true)).toBe(!hasCover(unproven, twoPaged, false));
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

    /** Flattens a chain into the page indices each unit covers, in order. */
    const covered = (chain: ReturnType<typeof buildUnitChain>) =>
      chain.starts.flatMap((start) => {
        const unit = chain.units.get(start);
        return unit?.isSpread ? [start, start + 1] : [start];
      });

    // Verify the cover is alone and the pages after it pair up as facing pages
    it("shows the cover alone and pairs the pages after it", () => {
      const { pages } = buildDims(["P", "P", "P", "P", "P", "P"]);
      const chain = buildUnitChain(pages, twoPaged, true);

      // Physical pages 1 | 2,3 | 4,5 | 6
      expect(chain.starts).toEqual([0, 1, 3, 5]);
      expect(chain.units.get(0)).toEqual({ isSpread: false, nextIndexIncrement: 1 });
      expect(chain.units.get(1)).toEqual({ isSpread: true, nextIndexIncrement: 2 });
    });

    // Verify an archive without a cover starts pairing from its very first image
    it("pairs from the first image when the archive has no cover", () => {
      const { pages } = buildDims(["P", "P", "P", "P", "P", "P"]);
      const chain = buildUnitChain(pages, twoPaged, false);

      // Physical pages 2,3 | 4,5 | 6,7
      expect(chain.starts).toEqual([0, 2, 4]);
    });

    // Verify a landscape image occupies two physical pages, keeping the pages after it aligned
    it("counts a landscape image as two physical pages", () => {
      const { pages } = buildDims(["P", "P", "P", "L", "P", "P"]);
      const chain = buildUnitChain(pages, twoPaged, true);

      // 1 | 2,3 | 4,5 (landscape) | 6,7
      expect(chain.starts).toEqual([0, 1, 3, 4]);
      expect(chain.units.get(3)).toEqual({ isSpread: false, nextIndexIncrement: 1 });
      expect(chain.units.get(4)).toEqual({ isSpread: true, nextIndexIncrement: 2 });
    });

    // Verify cover presence still changes the chain when the first image is landscape
    it("responds to cover presence when the first image is landscape", () => {
      const { pages } = buildDims(["L", "P", "P", "P"]);

      expect(buildUnitChain(pages, twoPaged, true).starts).not.toEqual(
        buildUnitChain(pages, twoPaged, false).starts,
      );
    });

    // Verify the same when the landscape image sits right after the cover
    it("responds to cover presence when the second image is landscape", () => {
      const { pages } = buildDims(["P", "L", "P", "P"]);

      expect(buildUnitChain(pages, twoPaged, true).starts).not.toEqual(
        buildUnitChain(pages, twoPaged, false).starts,
      );
    });

    // Verify every page belongs to exactly one unit, so no page is unreachable
    it("covers every page exactly once", () => {
      const { pages } = buildDims(["P", "P", "L", "P", "P", "P", "L"]);

      expect(covered(buildUnitChain(pages, twoPaged, true))).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(covered(buildUnitChain(pages, twoPaged, false))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    // Verify single-page mode never produces a spread
    it("produces only single units when two-paged view is off", () => {
      const { pages } = buildDims(["P", "P", "P"]);
      const chain = buildUnitChain(pages, { ...twoPaged, isTwoPagedView: false }, true);

      expect(chain.starts).toEqual([0, 1, 2]);
      expect(chain.starts.every((start) => chain.units.get(start)?.isSpread === false)).toBe(true);
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

    // Verify that a backend failure reaches the caller instead of being swallowed
    it("should reject when getImage fails", async () => {
      vi.mocked(ContainerCommands.getImage).mockRejectedValue(
        new CommandError(ErrorCode.image, "fetch failed"),
      );
      await expect(fetchImageBlob("path", "file")).rejects.toBeInstanceOf(CommandError);
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

    // An empty response is the backend declining to make a preview, and reads as null:
    // a caller that stops asking after a decline must not also stop after a failure.
    it("should return null if response is empty (skip preview)", async () => {
      const buffer = new ArrayBuffer(0);
      vi.mocked(ContainerCommands.getImagePreview).mockResolvedValue(buffer);
      const result = await fetchImagePreviewBlob("path", "file");
      expect(result).toBeNull();
    });

    // Verify that a failed request is distinguishable from the backend declining a preview
    it("should reject when getImagePreview fails", async () => {
      vi.mocked(ContainerCommands.getImagePreview).mockRejectedValue(
        new CommandError(ErrorCode.image, "preview failed"),
      );
      await expect(fetchImagePreviewBlob("path", "file")).rejects.toBeInstanceOf(CommandError);
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
