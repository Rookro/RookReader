import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Box } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { dirname } from "@tauri-apps/api/path";
import { debug, error } from '@tauri-apps/plugin-log';
import { AppDispatch, useSelector } from '../../Store';
import { openContainerFile, setContainerFilePath, setExploreBasePath, setImageIndex } from "../../reducers/FileReducer";
import { setIsFirstPageSingleView } from "../../reducers/ViewReducer";
import { Image } from "../../types/Image";
import { settingsStore } from "../../settings/SettingsStore";

/**
 * Gets an image.
 * 
 * @param containerPath Path to the image container.
 * @param entryName Entry name of the image.
 * @returns The loaded image.
 */
const getImage = async (containerPath: string, entryName: string | undefined) => {
    if (!containerPath || !entryName || containerPath.length === 0 || entryName.length === 0) {
        return undefined;
    }

    var response: ArrayBuffer;
    try {
        response = await invoke<ArrayBuffer>("get_image", { path: containerPath, entryName });
    } catch (ex) {
        error(JSON.stringify(ex));
        return;
    }

    return new Image(response);
}

/**
 * creates a URL for `<img>`.
 * 
 * @param image The image to create a URL for.
 * @returns URL of the image blob.
 */
const createImageURL = async (image: Image | undefined) => {
    if (!image) {
        return undefined;
    }

    const blob = new Blob([new Uint8Array(image.data)]);
    return URL.createObjectURL(blob);
}

/**
 * Displaying images component.
 */
export default function ImageViewer() {
    const { history, historyIndex, entries, index } = useSelector(state => state.file.containerFile);
    const { isTwoPagedView, direction, isFirstPageSingleView } = useSelector(state => state.view);
    const dispatch = useDispatch<AppDispatch>();

    const [firstSrc, setFirstSrc] = useState<string | undefined>(undefined);
    const [secondSrc, setSecondSrc] = useState<string | undefined>(undefined);
    const [canTwoPage, setCanTwoPage] = useState(isTwoPagedView);
    const [displayedIndexes, setDisplayedIndexes] = useState({ first: 0, second: undefined as number | undefined });
    const [isForward, setIsForward] = useState(true);

    const requestIdRef = useRef(0);
    const currentFirstRef = useRef<string | undefined>(undefined);
    const currentSecondRef = useRef<string | undefined>(undefined);
    const urlCacheRef = useRef<Map<string, { url: string; width: number; height: number }>>(new Map());
    const unlistenRef = useRef<null | (() => void)>(null as any);

    useEffect(() => {
        dispatch(openContainerFile(history[historyIndex]))
    }, [history, historyIndex]);

    useEffect(() => {
        urlCacheRef.current.forEach((cache) => {
            URL.revokeObjectURL(cache.url);
        });
        urlCacheRef.current.clear();
        currentFirstRef.current = undefined;
        currentSecondRef.current = undefined;
        setFirstSrc(undefined);
        setSecondSrc(undefined);
    }, [history[historyIndex]]);

    useEffect(() => {
        let mounted = true;
        const thisRequestId = ++requestIdRef.current;

        const setImage = async (firstImagePath: string, secondImagePath: string | undefined) => {
            const containerPath = history[historyIndex];
            const needed: string[] = [];
            if (firstImagePath) needed.push(firstImagePath);
            if (secondImagePath) {
                if (!needed.includes(secondImagePath)) {
                    needed.push(secondImagePath);
                }
            }

            const missing = needed.filter(name => !urlCacheRef.current.has(name));

            try {
                const fetchPromises = missing.map(async (name) => {
                    const img = await getImage(containerPath, name);
                    if (!img) {
                        return { name, url: undefined, width: 0, height: 0 };
                    }
                    const url = await createImageURL(img);
                    // store created URL and dimensions in cache
                    if (url) {
                        urlCacheRef.current.set(name, { url, width: img.width, height: img.height });
                    }
                    return { name, url, width: img.width, height: img.height };
                });

                await Promise.all(fetchPromises);
            } catch (e) {
                error(`Error fetching images: ${JSON.stringify(e)}`);
            }

            // If a newer request has started, do nothing.
            if (!mounted || thisRequestId !== requestIdRef.current) {
                return;
            }

            const first = firstImagePath ? (urlCacheRef.current.get(firstImagePath)) : undefined;
            const second = secondImagePath ? (urlCacheRef.current.get(secondImagePath)) : undefined;

            const firstIsWide = !!first && first.width > first.height;
            const secondIsWide = !!second && second.width > second.height;
            const eitherWide = firstIsWide || secondIsWide;

            const firstUrl = first ? first.url : (firstImagePath ? (urlCacheRef.current.get(firstImagePath)?.url) : undefined);
            const secondUrl = second ? second.url : (secondImagePath ? (urlCacheRef.current.get(secondImagePath)?.url) : undefined);

            if (!isTwoPagedView || !secondImagePath) {
                setFirstSrc(firstUrl);
                setSecondSrc(undefined);
                setCanTwoPage(false);
                setDisplayedIndexes({ first: index, second: undefined });
                currentFirstRef.current = firstUrl;
                currentSecondRef.current = undefined;
            } else if (eitherWide) {
                // If either page is wide, show single page.
                if (isForward) {
                    setFirstSrc(firstUrl);
                    setSecondSrc(undefined);
                    setCanTwoPage(false);
                    setDisplayedIndexes({ first: index, second: undefined });
                    currentFirstRef.current = firstUrl || undefined;
                    currentSecondRef.current = undefined;
                } else {
                    setFirstSrc(secondUrl);
                    setSecondSrc(undefined);
                    setCanTwoPage(false);
                    setDisplayedIndexes({ first: index + 1, second: undefined });
                    currentFirstRef.current = secondUrl;
                    currentSecondRef.current = undefined;
                }
            } else if (index === 0 && isFirstPageSingleView) {
                setFirstSrc(firstUrl);
                setSecondSrc(undefined);
                setCanTwoPage(false);
                setDisplayedIndexes({ first: index, second: undefined });
                currentFirstRef.current = firstUrl;
                currentSecondRef.current = undefined;
            }
            else {
                if (firstUrl && secondUrl) {
                    setFirstSrc(firstUrl);
                    setSecondSrc(secondUrl);
                    setCanTwoPage(true);
                    setDisplayedIndexes({ first: index, second: index + 1 });
                    currentFirstRef.current = firstUrl;
                    currentSecondRef.current = secondUrl;
                } else {
                    setFirstSrc(firstUrl);
                    setSecondSrc(undefined);
                    setCanTwoPage(false);
                    setDisplayedIndexes({ first: index, second: undefined });
                    currentFirstRef.current = firstUrl;
                    currentSecondRef.current = undefined;
                }
            }
        }

        let nextPath: string | undefined = undefined;
        if (entries.length > index + 1) {
            nextPath = entries[index + 1];
        }
        setImage(entries[index], nextPath);

        return () => {
            mounted = false;
        };
    }, [entries, index, isTwoPagedView, isForward, isFirstPageSingleView]);

    useEffect(() => {
        const initSettings = async () => {
            const isFirstPageSingleView = await settingsStore.get<boolean>("first-page-single-view") ?? true;
            dispatch(setIsFirstPageSingleView(isFirstPageSingleView));

            const pdfRenderingHeight = await settingsStore.get<number>("pdf-rendering-height");
            if (pdfRenderingHeight) {
                await invoke("set_pdf_rendering_height", { height: pdfRenderingHeight });
            }
        };
        initSettings();

        return () => {
            urlCacheRef.current.forEach((cache) => {
                URL.revokeObjectURL(cache.url);
            });
            urlCacheRef.current.clear();
            if (currentFirstRef.current) {
                URL.revokeObjectURL(currentFirstRef.current);
            }
            if (currentSecondRef.current) {
                URL.revokeObjectURL(currentSecondRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let unlisten: UnlistenFn;
        const listenDragDrop = async () => {
            // Sets a file by drag and drop.
            // Only the first one is used, if multiple files are dragged.
            unlisten = await listen("tauri://drag-drop", async (event) => {
                const path = (event.payload as { paths: string[] }).paths[0];
                debug(`DragDrop ${path}.`);
                dispatch(setContainerFilePath(path));
                dispatch(setExploreBasePath(await dirname(path)));
            });
            unlistenRef.current = unlisten;
        }
        listenDragDrop();
        return () => {
            if (unlistenRef.current) {
                (unlistenRef.current as UnlistenFn)();
                unlistenRef.current = null;
            }
        };
    }, [dispatch]);

    const moveFoward = () => {
        const forwardIndex = displayedIndexes.second ? displayedIndexes.second + 1 : displayedIndexes.first + 1;
        if (entries.length <= forwardIndex) {
            return;
        }
        setIsForward(true);
        dispatch(setImageIndex(forwardIndex));
    }
    const moveBack = () => {
        const backIndex = isTwoPagedView ? displayedIndexes.first - 2 : displayedIndexes.first - 1;;
        if (backIndex < 0) {
            setIsForward(true);
            if (index !== 0) {
                dispatch(setImageIndex(0));
            }
            return;
        }
        setIsForward(false);
        dispatch(setImageIndex(backIndex));
    }

    // Left click
    const handleClicked = (_e: React.MouseEvent<HTMLDivElement>) => {
        moveFoward();
    }

    // Right click
    const handleContextMenu = (_e: React.MouseEvent<HTMLDivElement>) => {
        moveBack();
    }

    const handleWheeled = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY < 0) {
            moveBack();
        }
        if (e.deltaY > 0) {
            moveFoward();
        }
    }

    const handleKeydown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case "ArrowLeft":
                if (direction === "rtl") {
                    moveFoward();
                } else {
                    moveBack();
                }
                break;
            case "ArrowRight":
                if (direction === "rtl") {
                    moveBack();
                } else {
                    moveFoward();
                }
                break;
            default:
                return;
        }
    }

    return (
        <Box
            tabIndex={0}
            onClick={handleClicked}
            onContextMenu={handleContextMenu}
            onWheel={handleWheeled}
            onKeyDown={handleKeydown}
            sx={{
                width: '100%',
                display: 'flex',
            }}
        >
            {canTwoPage ?
                <>
                    <Box
                        component="img"
                        src={direction === "ltr" ? firstSrc : secondSrc}
                        sx={{ width: '50%', objectPosition: 'right center', objectFit: 'contain' }}
                    />
                    <Box
                        component="img"
                        src={direction === "ltr" ? secondSrc : firstSrc}
                        sx={{ width: '50%', objectPosition: 'left center', objectFit: 'contain' }}
                    />
                </> :
                <Box
                    component="img"
                    src={firstSrc}
                    sx={{ width: '100%', objectPosition: 'center center', objectFit: 'contain' }}
                />
            }
        </Box>
    );
}
