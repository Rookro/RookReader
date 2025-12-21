import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ImageCacheItem, ViewLayout, ViewerSettings, calculateLayout, fetchImageBlob, createBlobUrl } from "../utils/ImageUtils";
import { setImageIndex } from "../reducers/FileReducer";
import { AppDispatch } from "../Store";

/**
 * ViewerController hook return type.
 */
export interface ViewerController {
    /** Layout to display. */
    displayedLayout: ViewLayout | null;
    /** Is loading a image. */
    isImageLoading: boolean;
    /** Move forward action. */
    moveForward: () => void;
    /** Move backward action. */
    moveBack: () => void;
}

/**
 * Hooks for controlling the image viewer.
 * 
 * @param containerPath The path of the container file.
 * @param entries Entries in the container.
 * @param index Index of the current image.
 * @param settings Viewer settings.
 * @param dispatch Dispatch function from Redux.
 * @returns ViewerController.
 */
export const useViewerController = (
    containerPath: string,
    entries: string[],
    index: number,
    settings: ViewerSettings,
    dispatch: AppDispatch
): ViewerController => {
    const [cache, setCache] = useState<Map<string, ImageCacheItem>>(new Map());
    const [displayedLayout, setDisplayedLayout] = useState<ViewLayout | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Clear cache and layout when containerPath changes.
    useEffect(() => {
        cache.forEach((item) => URL.revokeObjectURL(item.url));
        setCache(new Map());
        setDisplayedLayout(null);
    }, [containerPath]);

    // Loads images for the current index (and next index if two-page view).
    useEffect(() => {
        if (!containerPath || entries.length === 0) {
            setIsImageLoading(false);
            return;
        }

        const loadImages = async () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const pathsToLoad = [entries[index]];
            if (settings.isTwoPagedView && index + 1 < entries.length) {
                pathsToLoad.push(entries[index + 1]);
            }

            const missingPaths = pathsToLoad.filter(p => !cache.has(p));

            if (missingPaths.length === 0) {
                setIsImageLoading(false);
                return;
            }

            setIsImageLoading(true);
            const newItems = new Map<string, ImageCacheItem>();

            await Promise.all(missingPaths.map(async (path) => {
                const img = await fetchImageBlob(containerPath, path);
                if (img && !controller.signal.aborted) {
                    const url = createBlobUrl(img);
                    newItems.set(path, { url, width: img.width, height: img.height });
                }
            }));

            if (!controller.signal.aborted) {
                setCache(prev => {
                    const next = new Map(prev);
                    newItems.forEach((val, key) => next.set(key, val));
                    return next;
                });
                setIsImageLoading(false);
            }
        };

        loadImages();
        return () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
        };
    }, [containerPath, index, entries, settings.isTwoPagedView]);

    const nextLayout = useMemo(() => {
        return calculateLayout(index, entries, cache, settings);
    }, [index, entries, cache, settings]);

    // Update displayed layout when next layout is calculated.
    useEffect(() => {
        if (nextLayout) {
            setDisplayedLayout(nextLayout);
        }
    }, [nextLayout]);

    const moveForward = useCallback(() => {
        if (entries.length === 0) {
            return;
        }

        const increment = nextLayout?.nextIndexIncrement ?? (settings.isTwoPagedView ? 2 : 1);
        const nextIndex = index + increment;

        if (nextIndex < entries.length) {
            dispatch(setImageIndex(nextIndex));
        }
    }, [index, entries.length, dispatch, nextLayout, settings]);

    const moveBack = useCallback(() => {
        if (entries.length === 0) {
            return;
        }

        if (index === 0) {
            return;
        }

        if (!settings.isTwoPagedView) {
            dispatch(setImageIndex(Math.max(0, index - 1)));
            return;
        }

        const indexFor1PagesBack = Math.max(0, index - 1);
        const simulatedLayoutFor1PagesBack = calculateLayout(indexFor1PagesBack, entries, cache, settings);

        // If the previous page is landscape, go back only one page.
        if (simulatedLayoutFor1PagesBack && !simulatedLayoutFor1PagesBack.isSpread && simulatedLayoutFor1PagesBack.firstImage && simulatedLayoutFor1PagesBack.firstImage.width > simulatedLayoutFor1PagesBack.firstImage.height) {
            dispatch(setImageIndex(indexFor1PagesBack));
            return;
        }

        const indexFor2PagesBack = Math.max(0, index - 2);
        const simulatedLayoutFor2PagesBack = calculateLayout(indexFor2PagesBack, entries, cache, settings);

        // If the layout calculation fails, fall back to going back two pages.
        if (!simulatedLayoutFor2PagesBack) {
            dispatch(setImageIndex(indexFor2PagesBack));
            return;
        }

        // If the page 2 steps back is landscape, go back only one page.
        if (!simulatedLayoutFor2PagesBack.isSpread && simulatedLayoutFor2PagesBack.firstImage && simulatedLayoutFor2PagesBack.firstImage.width > simulatedLayoutFor2PagesBack.firstImage.height) {
            dispatch(setImageIndex(indexFor1PagesBack));
            return;
        }

        dispatch(setImageIndex(indexFor2PagesBack));
    }, [index, entries, cache, settings, dispatch]);

    return {
        displayedLayout,
        isImageLoading,
        moveForward,
        moveBack,
    };
};
