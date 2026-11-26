import { error } from "@tauri-apps/plugin-log";
import { createCommandError, type ErrorCode } from "../../../types/Error";
import type { Image } from "../../../types/Image";
import {
  createImageCacheItem,
  fetchImageBlob,
  fetchImagePreviewBlob,
  type ImageCacheItem,
  revokeCacheItemUrls,
} from "./ImageUtils";

/**
 * The pages the viewer loads for an index: the page itself and, in spread view, the one
 * after it.
 *
 * Built from the index and the two-page setting, never from the unit, so both pages of a
 * spread are already decoded when the pairing lands.
 *
 * @param entries The list of entry names.
 * @param index The current index.
 * @param isTwoPagedView Whether the viewer pairs pages.
 * @returns The entry names to load.
 */
export const pagesToLoad = (
  entries: string[],
  index: number,
  isTwoPagedView: boolean,
): string[] => {
  const pages = [entries[index]];
  if (isTwoPagedView && index + 1 < entries.length) {
    pages.push(entries[index + 1]);
  }
  return pages;
};

/**
 * Decodes an image URL into an element that holds the decoded bitmap.
 *
 * @param url The URL of the image.
 * @returns The decoded element, or undefined if the image could not be decoded.
 */
const decodeImage = async (url: string): Promise<HTMLImageElement | undefined> => {
  const element = document.createElement("img");
  element.src = url;
  try {
    await element.decode();
    return element;
  } catch {
    // A broken page still reaches the reader as a broken image, and decode() also
    // rejects for reasons that are not errors.
    return undefined;
  }
};

/** What loading one page into the cache came to. */
export type PageLoadResult =
  /** The page is in the cache; `isLandscape` is the loaded image's own shape. */
  | { status: "loaded"; isLandscape: boolean }
  /** The backend could not produce the page. */
  | { status: "failed"; code: ErrorCode }
  /** Nothing was loaded: the load was aborted, or there was nothing to ask for. */
  | { status: "skipped" };

/**
 * Loads a page, or its preview, and adds it to the cache entry for that page.
 *
 * @param cache The page cache, edited in place.
 * @param containerPath The path of the container file.
 * @param entry The entry name of the page.
 * @param isPreview Whether to load the page's preview instead of the page.
 * @param generation The reader's display generation; a newer one cancels older queued requests.
 * @param signal Aborts the load; a load aborted at any point stores nothing.
 * @returns What the load came to; see {@link PageLoadResult}.
 */
export const loadPageIntoCache = async (
  cache: Map<string, ImageCacheItem>,
  containerPath: string,
  entry: string,
  isPreview: boolean,
  generation: number,
  signal: AbortSignal,
): Promise<PageLoadResult> => {
  if (signal.aborted) return { status: "skipped" };
  let img: Image | null | undefined;
  try {
    img = await (isPreview ? fetchImagePreviewBlob : fetchImageBlob)(
      containerPath,
      entry,
      generation,
    );
  } catch (e) {
    if (signal.aborted) {
      return { status: "skipped" };
    }
    const commandError = createCommandError(e);
    error(
      `Failed to load ${isPreview ? "a preview" : "an image"} of ${entry}: ` +
        `${commandError.message} (code ${commandError.code})`,
    );
    return { status: "failed", code: commandError.code };
  }
  if (!img || signal.aborted) {
    return { status: "skipped" };
  }
  const newItem = createImageCacheItem(img, isPreview);
  const url = isPreview ? newItem.previewUrl : newItem.fullUrl;
  // A preview behind its full page is never displayed, so it is not worth decoding.
  const image =
    url && !(isPreview && cache.get(entry)?.fullUrl) ? await decodeImage(url) : undefined;
  if (signal.aborted) {
    revokeCacheItemUrls(newItem);
    return { status: "skipped" };
  }
  // Read again: the entry may have changed during the decode.
  const existingItem = cache.get(entry);
  if (existingItem) {
    if (isPreview) {
      existingItem.previewUrl = newItem.previewUrl;
      if (!existingItem.fullUrl) {
        existingItem.decoded = image;
      }
    } else {
      existingItem.fullUrl = newItem.fullUrl;
      existingItem.decoded = image;
    }
  } else {
    newItem.decoded = image;
    cache.set(entry, newItem);
  }
  // The new item's own dimensions: an entry its preview created keeps the preview's.
  return { status: "loaded", isLandscape: newItem.width > newItem.height };
};
