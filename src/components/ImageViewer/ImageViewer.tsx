import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDispatch } from "react-redux";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { debug, error } from '@tauri-apps/plugin-log';
import { AppDispatch, useSelector } from '../../Store';
import { openContainerFile, setContainerFilePath, setExploreBasePath, setImageIndex } from "../../reducers/FileReducer";
import { Image } from "../../types/Image";
import "./ImageViewer.css";
import { dirname } from "@tauri-apps/api/path";

/**
 * 画像ファイルを読み込む
 * 
 * @param containerPath 画像コンテナのパス
 * @param entryName 画像のエントリー名
 * @returns 読み込んだ画像
 */
const getImage = async (containerPath: string, entryName: string | undefined) => {
    if (!containerPath || !entryName || containerPath.length === 0 || entryName.length === 0) {
        return undefined;
    }

    try {
        return await invoke<Image>("get_image", { path: containerPath, entryName });
    } catch (ex) {
        error(JSON.stringify(ex));
    }
}

/**
 * 事前ロードを行う
 * 
 * @param containerPath コンテナパス
 * @param entries エントリーリスト
 * @param currentIndex 現在のインデックス
 */
const preload = async (containerPath: string, entries: string[], currentIndex: number) => {
    if (!containerPath || !entries || containerPath.length === 0 || entries.length === 0) {
        return;
    }

    invoke<void>("async_preload", { startIndex: currentIndex + 1, count: 10 })
        .then(() => { debug(`Preloaded from ${currentIndex + 1} to ${currentIndex + 10}.`) })
        .catch((ex) => { error(`Failed to preload from ${currentIndex + 1} to ${currentIndex + 10}. ${JSON.stringify(ex)}`); });
}

/**
 * 画像ファイルを読み込み、`<img>` 用の URL を作成する
 * 
 * @param path 画像パス
 * @returns 画像BlobのURL
 */
const createImageURL = async (image: Image | undefined) => {
    if (!image) {
        return undefined;
    }

    const blob = new Blob([new Uint8Array(image.data)]);
    return URL.createObjectURL(blob);
}

/**
 * 画像表示用コンポーネント
 */
function ImageViewer() {
    const { history, historyIndex, entries, index } = useSelector(state => state.file.containerFile);
    const { isTwoPagedView, direction } = useSelector(state => state.view);
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

            // より新しいリクエストが開始していたら、何もしない
            if (!mounted || thisRequestId !== requestIdRef.current) {
                return;
            }

            const first = firstImagePath ? (urlCacheRef.current.get(firstImagePath)) : undefined;
            const second = secondImagePath ? (urlCacheRef.current.get(secondImagePath)) : undefined;

            preload(containerPath, entries, index);

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
            } else {
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
    }, [entries, index, isTwoPagedView, isForward]);

    useEffect(() => {
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
            // ドラッグアンドドロップでファイルを指定する
            // 複数指定された場合は、最初の一つのみ
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

    const handleClicked = (_e: React.MouseEvent<HTMLDivElement>) => {
        // 左クリック
        moveFoward();
    }

    const handleContextMenu = (_e: React.MouseEvent<HTMLDivElement>) => {
        // 右クリック
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
                if (direction === "right") {
                    moveFoward();
                } else {
                    moveBack();
                }
                break;
            case "ArrowRight":
                if (direction === "right") {
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
        <div className="image_viewer" tabIndex={0} onClick={handleClicked} onContextMenu={handleContextMenu} onWheel={handleWheeled} onKeyDown={handleKeydown}>
            {canTwoPage ?
                <>
                    <img className="left" src={direction === "left" ? firstSrc : secondSrc} />
                    <img className="right" src={direction === "left" ? secondSrc : firstSrc} />
                </> :
                <>
                    <img className="single" src={firstSrc} />
                </>
            }
        </div>
    );
}

export default ImageViewer;
