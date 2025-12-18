import { invoke } from "@tauri-apps/api/core";
import { error } from '@tauri-apps/plugin-log';
import { Image } from "../types/Image";

/**
 * Cache for an image.
 */
export interface ImageCacheItem {
    url: string;
    width: number;
    height: number;
}

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
 * Settings for the viewer.
 */
export interface ViewerSettings {
    /** Is the viewer in two-page view mode. */
    isTwoPagedView: boolean;
    /** Is the first page displayed in single view mode. */
    isFirstPageSingleView: boolean;
    /** Direction of the viewer. */
    direction: "ltr" | "rtl";
}

/**
 * Fetches an image blob from the backend.
 *
 * @param containerPath The path of the container file.
 * @param entryName The name of the entry to fetch.
 * @returns The fetched image or undefined if the fetch failed.
 */
export const fetchImageBlob = async (containerPath: string, entryName: string): Promise<Image | undefined> => {
    if (!containerPath || !entryName || containerPath.length === 0 || entryName.length === 0) {
        return undefined;
    }
    try {
        const response = await invoke<ArrayBuffer>("get_image", { path: containerPath, entryName });
        return new Image(response);
    } catch (ex) {
        error(`Failed to load an image of ${entryName}: ${JSON.stringify(ex)}`);
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
    const firstPath = entries[currentIndex];
    const secondPath = entries[currentIndex + 1];

    const firstImg = cache.get(firstPath);

    if (!firstImg) {
        return null;
    }

    if (!settings.isTwoPagedView || !secondPath) {
        return { firstImage: firstImg, isSpread: false, nextIndexIncrement: 1 };
    }

    if (firstImg.width > firstImg.height) {
        return { firstImage: firstImg, isSpread: false, nextIndexIncrement: 1 };
    }

    if (currentIndex === 0 && settings.isFirstPageSingleView) {
        return { firstImage: firstImg, isSpread: false, nextIndexIncrement: 1 };
    }


    const secondImg = cache.get(secondPath);

    if (!secondImg) {
        return null;
    }

    if (secondImg.width > secondImg.height) {
        return { firstImage: firstImg, isSpread: false, nextIndexIncrement: 1 };
    }

    return {
        firstImage: firstImg,
        secondImage: secondImg,
        isSpread: true,
        nextIndexIncrement: 2
    };
};
