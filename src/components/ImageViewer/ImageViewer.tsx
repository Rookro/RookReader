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
        return "";
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

    const [firstSrc, setFirstSrc] = useState("");
    const [secondSrc, setSecondSrc] = useState("");
    const [canTwoPage, setCanTwoPage] = useState(isTwoPagedView);
    const [displayedIndexes, setDisplayedIndexes] = useState({ first: 0, second: undefined as number | undefined });
    const [isForward, setIsForward] = useState(true);

    const requestIdRef = useRef(0);
    const currentFirstRef = useRef<string>("");
    const currentSecondRef = useRef<string>("");
    const unlistenRef = useRef<null | (() => void)>(null as any);

    useEffect(() => {
        dispatch(openContainerFile(history[historyIndex]))
    }, [history, historyIndex]);

    useEffect(() => {
        let mounted = true;
        const thisRequestId = ++requestIdRef.current;

        const setImage = async (firstImagePath: string, secondImagePath: string | undefined) => {
            const containerPath = history[historyIndex];

            const firstImage = await getImage(containerPath, firstImagePath);
            const firstImgSrc = await createImageURL(firstImage);
            const secondImage = await getImage(containerPath, secondImagePath);
            const secondImgSrc = await createImageURL(secondImage);

            // より新しいリクエストが開始していたら、破棄する
            if (!mounted || thisRequestId !== requestIdRef.current) {
                if (firstImgSrc) {
                    URL.revokeObjectURL(firstImgSrc);
                }
                if (secondImgSrc) {
                    URL.revokeObjectURL(secondImgSrc);
                }
                return;
            }

            // 置き換え前に以前の URL を破棄する
            if (currentFirstRef.current) {
                URL.revokeObjectURL(currentFirstRef.current);
            }
            if (currentSecondRef.current) {
                URL.revokeObjectURL(currentSecondRef.current);
            }

            preload(containerPath, entries, index);

            if (!isTwoPagedView || !secondImagePath) {
                // 一ページ表示か二枚目画像がない場合
                setFirstSrc(firstImgSrc);
                setSecondSrc("");
                setCanTwoPage(false);
                setDisplayedIndexes({ first: index, second: undefined });
            } else if ((firstImage && firstImage.width > firstImage.height) || (secondImage && secondImage.width > secondImage.height)) {
                // どちらかの画像が横長の場合
                if (isForward) {
                    setFirstSrc(firstImgSrc);
                    setSecondSrc("");
                    setCanTwoPage(false);
                    setDisplayedIndexes({ first: index, second: undefined });
                } else {
                    setFirstSrc(secondImgSrc);
                    setSecondSrc("");
                    setCanTwoPage(false);
                    setDisplayedIndexes({ first: index + 1, second: undefined });
                }
            } else {
                setFirstSrc(firstImgSrc);
                setSecondSrc(secondImgSrc);
                setCanTwoPage(true);
                setDisplayedIndexes({ first: index, second: index + 1 });
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
            if (currentFirstRef.current) {
                try { URL.revokeObjectURL(currentFirstRef.current); } catch { }
            }
            if (currentSecondRef.current) {
                try { URL.revokeObjectURL(currentSecondRef.current); } catch { }
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
