import { debug, error } from "@tauri-apps/plugin-log";
import { getImage, getImagePreview } from "../../../bindings/ContainerCommands";
import { Image } from "../../../types/Image";

/**
 * Cache for an image.
 */
export class ImageCacheItem {
  constructor(
    /** Width of the image. */
    public width: number,
    /** Height of the image. */
    public height: number,
    /** URL of the preview image. */
    public previewUrl?: string,
    /** URL of the image. */
    public fullUrl?: string,
  ) {}

  /**
   * Returns the full URL if available, otherwise the preview URL.
   */
  get url(): string | undefined {
    return this.fullUrl || this.previewUrl;
  }
}

/**
 * Revokes the object URLs (preview and full) held by a single cache item.
 *
 * @param item - The cache item whose `previewUrl`/`fullUrl` object URLs should be revoked.
 */
export const revokeCacheItemUrls = (item: ImageCacheItem) => {
  if (item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
  if (item.fullUrl) {
    URL.revokeObjectURL(item.fullUrl);
  }
};

/**
 * Layout for displaying images.
 */
export interface ViewLayout {
  /** First image in the layout. */
  firstImage?: ImageCacheItem;
  /** Second image in the layout. */
  secondImage?: ImageCacheItem;
  /** Is the layout a spread (two pages). */
  isSpread: boolean;
  /** Increment for the next index. */
  nextIndexIncrement: number;
}

/**
 * Pixel dimensions of a page.
 */
export interface PageDims {
  /** Width of the page. */
  width: number;
  /** Height of the page. */
  height: number;
}

/**
 * Returns the dimensions of the entry at the given index, or undefined when unknown.
 */
export type DimsLookup = (index: number) => PageDims | undefined;

/**
 * Decision for a single display unit, independent of whether its images are loaded.
 */
export interface UnitDecision {
  /** Is the unit a spread (two pages). */
  isSpread: boolean;
  /** Increment for the next index. */
  nextIndexIncrement: number;
}

/**
 * Settings for the viewer.
 */
export interface ViewerSettings {
  /** Is the viewer in two-page view mode. */
  isTwoPagedView: boolean;
  /** Is the first page displayed in single view mode. */
  isFirstPageSingleView: boolean;
  /** Direction of the viewer. */
  direction: "ltr" | "rtl";
  /** Enable preview. */
  enablePreview: boolean;
  /** The number of pages to preload in each direction. */
  preloadPageCount: number;
}

/**
 * Fetches an image blob from the backend.
 *
 * @param containerPath The path of the container file.
 * @param entryName The name of the entry to fetch.
 * @returns The fetched image or undefined if the fetch failed.
 */
export const fetchImageBlob = async (
  containerPath: string,
  entryName: string,
): Promise<Image | undefined> => {
  if (!containerPath || !entryName || containerPath.length === 0 || entryName.length === 0) {
    return undefined;
  }
  try {
    const response = await getImage(containerPath, entryName);
    return new Image(response);
  } catch (ex) {
    error(`Failed to load an image of ${entryName}: ${JSON.stringify(ex)}`);
    return undefined;
  }
};

/**
 * Fetches an image preview blob from the backend.
 *
 * @param containerPath The path of the container file.
 * @param entryName The name of the entry to fetch.
 * @returns The fetched image or undefined if the fetch failed.
 */
export const fetchImagePreviewBlob = async (
  containerPath: string,
  entryName: string,
): Promise<Image | undefined> => {
  if (!containerPath || !entryName || containerPath.length === 0 || entryName.length === 0) {
    return undefined;
  }
  try {
    const response = await getImagePreview(containerPath, entryName);
    if (response.byteLength === 0) {
      debug(`Skip preview image for ${entryName}`);
      return undefined;
    }
    return new Image(response);
  } catch (ex) {
    error(`Failed to load an image preview of ${entryName}: ${JSON.stringify(ex)}`);
    return undefined;
  }
};

/**
 * Creates a blob URL from an image.
 *
 * @param image The image to create a blob URL for.
 * @returns The blob URL.
 */
export const createBlobUrl = (image: Image): string => {
  const blob = new Blob([new Uint8Array(image.data)]);
  return URL.createObjectURL(blob);
};

/**
 * Creates an ImageCacheItem from an image.
 *
 * @param image The image to create an ImageCacheItem from.
 * @param isPreview Whether the image is a preview.
 * @returns The created ImageCacheItem.
 */
export const createImageCacheItem = (image: Image, isPreview: boolean): ImageCacheItem => {
  const url = createBlobUrl(image);
  return new ImageCacheItem(
    image.width,
    image.height,
    isPreview ? url : undefined,
    !isPreview ? url : undefined,
  );
};

/**
 * Builds a single-page (non-spread) layout for an already-loaded first image.
 *
 * @param firstImage The cached first image to display alone.
 * @returns A single-page ViewLayout that advances by one index.
 */
export const buildSinglePageLayout = (firstImage: ImageCacheItem): ViewLayout => ({
  firstImage,
  isSpread: false,
  nextIndexIncrement: 1,
});

/** Decision shared by every single-page unit. */
const SINGLE_UNIT: UnitDecision = { isSpread: false, nextIndexIncrement: 1 };

/**
 * Decides the display unit starting at `currentIndex` from page dimensions alone.
 *
 * This holds the spread rules; layout building only attaches images to the decision.
 *
 * @param currentIndex The index the unit starts at.
 * @param entries The list of entry names.
 * @param getDims Lookup for page dimensions.
 * @param settings The viewer settings.
 * @returns The unit decision, or null when a dimension needed to decide is unknown.
 */
export const resolveUnit = (
  currentIndex: number,
  entries: string[],
  getDims: DimsLookup,
  settings: ViewerSettings,
): UnitDecision | null => {
  const first = getDims(currentIndex);

  if (!first) {
    return null;
  }

  if (!settings.isTwoPagedView || currentIndex + 1 >= entries.length) {
    return SINGLE_UNIT;
  }

  if (first.width > first.height) {
    return SINGLE_UNIT;
  }

  if (currentIndex === 0 && settings.isFirstPageSingleView) {
    return SINGLE_UNIT;
  }

  const second = getDims(currentIndex + 1);

  if (!second) {
    return null;
  }

  if (second.width > second.height) {
    return SINGLE_UNIT;
  }

  return { isSpread: true, nextIndexIncrement: 2 };
};

/**
 * Attaches cached images to a unit decision.
 *
 * @param unit The decided unit.
 * @param currentIndex The index the unit starts at.
 * @param entries The list of entry names.
 * @param cache The image cache.
 * @returns The layout, or null when a required image is not cached yet.
 */
export const buildUnitLayout = (
  unit: UnitDecision,
  currentIndex: number,
  entries: string[],
  cache: Map<string, ImageCacheItem>,
): ViewLayout | null => {
  const firstImage = cache.get(entries[currentIndex]);

  if (!firstImage) {
    return null;
  }

  if (!unit.isSpread) {
    return { firstImage, isSpread: false, nextIndexIncrement: unit.nextIndexIncrement };
  }

  const secondImage = cache.get(entries[currentIndex + 1]);

  if (!secondImage) {
    return null;
  }

  return { firstImage, secondImage, isSpread: true, nextIndexIncrement: unit.nextIndexIncrement };
};

/**
 * Finds the start index of the page unit immediately preceding `currentIndex` by
 * walking unit boundaries forward from page 0.
 *
 * Spread boundaries depend on the whole chain from the start, so the previous unit
 * cannot be derived from a local look-back. This walk uses the same per-unit
 * `nextIndexIncrement` as forward navigation, keeping back/forward in sync.
 *
 * @param currentIndex The current unit-start index to step back from.
 * @param entries The list of entry names.
 * @param getDims Lookup for page dimensions.
 * @param settings The viewer settings.
 * @returns The previous unit's start index, or `null` when `currentIndex <= 0`, when a
 *   page dimension needed to reach `currentIndex` is unknown, or when `currentIndex`
 *   is not a real unit start under the current layout (the caller should fall back).
 */
export const findPreviousUnitStart = (
  currentIndex: number,
  entries: string[],
  getDims: DimsLookup,
  settings: ViewerSettings,
): number | null => {
  if (currentIndex <= 0) {
    return null;
  }
  let start = 0;
  let prev = 0;
  while (start < currentIndex) {
    const unit = resolveUnit(start, entries, getDims, settings);
    if (!unit) {
      // A page dimension on the path is unknown; can't reconstruct boundaries.
      return null;
    }
    prev = start;
    start += unit.nextIndexIncrement;
  }
  // Overshooting means `currentIndex` is not a real unit start under this layout.
  if (start !== currentIndex) {
    return null;
  }
  return prev;
};

/**
 * Calculates the view layout based on the current state.
 * Returns null if required images are not yet cached, preventing partial layout decisions.
 *
 * @param currentIndex The current index in the entries list.
 * @param entries The list of entry names.
 * @param cache The image cache.
 * @param settings The viewer settings.
 * @returns The calculated layout or null if not enough information is available.
 */
export const calculateLayout = (
  currentIndex: number,
  entries: string[],
  cache: Map<string, ImageCacheItem>,
  settings: ViewerSettings,
): ViewLayout | null => {
  const unit = resolveUnit(currentIndex, entries, (i) => cache.get(entries[i]), settings);

  if (!unit) {
    return null;
  }

  return buildUnitLayout(unit, currentIndex, entries, cache);
};
