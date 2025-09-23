import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDispatch } from "react-redux";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { debug, error } from '@tauri-apps/plugin-log';
import { AppDispatch, useSelector } from '../../Store';
import { setContainerFile, setImageIndex } from "../../reducers/FileReducer";
import { Image } from "../../types/Image";
import "./ImageViewer.css";

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

    invoke<void>("async_preload", { startIndex: currentIndex + 1, count: 10 }).catch((ex) => { error(JSON.stringify(ex)); });
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
    const { path: containerPath, entries, index } = useSelector(state => state.file.containerFile);
    const { isTwoPagedView, direction } = useSelector(state => state.view);
    const dispatch = useDispatch<AppDispatch>();

    const [firstSrc, setFirstSrc] = useState("");
    const [secondSrc, setSecondSrc] = useState("");
    const [canTwoPage, setCanTwoPage] = useState(isTwoPagedView);
    const [isForward, setIsForward] = useState(true);

    useEffect(() => { dispatch(setImageIndex(0)) }, [containerPath]);

    useEffect(() => {
        const setImage = async (firstImagePath: string, secondImagePath: string | undefined) => {
            if (firstSrc.length > 0) {
                URL.revokeObjectURL(firstSrc);
            }
            if (secondSrc.length > 0) {
                URL.revokeObjectURL(secondSrc);
            }
            const firstImage = await getImage(containerPath, firstImagePath);
            const firstImgSrc = await createImageURL(firstImage);
            const secondImage = await getImage(containerPath, secondImagePath);
            const secondImgSrc = await createImageURL(secondImage);
            preload(containerPath, entries, index);
            if (!isTwoPagedView || !secondImagePath) {
                // 一ページ表示か二枚目画像がない場合
                setFirstSrc(firstImgSrc);
                setSecondSrc("");
                setCanTwoPage(false);
            } else if (!isForward && secondImage && secondImage.width > secondImage.height) {
                // 後ろに戻っている状態で二枚目の画像が横長の場合
                setFirstSrc(secondImgSrc);
                setSecondSrc("");
                setCanTwoPage(false);
            } else if (isForward && (firstImage && firstImage.width > firstImage.height) || (secondImage && secondImage.width > secondImage.height)) {
                // 前に進んでいる状態でどちらかの画像が横長の場合
                setFirstSrc(firstImgSrc);
                setSecondSrc("");
                setCanTwoPage(false);
            } else {
                setFirstSrc(firstImgSrc);
                setSecondSrc(secondImgSrc);
                setCanTwoPage(true);
            }
        }
        let nextPath: string | undefined = undefined;
        if (entries.length > index + 1) {
            nextPath = entries[index + 1];
        }
        setImage(entries[index], nextPath);
    }, [containerPath, entries, index, isTwoPagedView]);

    useEffect(() => {
        let unlisten: UnlistenFn;
        const listenDragDrop = async () => {
            // ドラッグアンドドロップでファイルを指定する
            // 複数指定された場合は、最初の一つのみ
            unlisten = await listen("tauri://drag-drop", (event) => {
                const path = (event.payload as { paths: string[] }).paths[0];
                debug(`DragDrop ${path}.`);
                dispatch(setContainerFile(path));
            });
        }
        listenDragDrop();
        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [dispatch]);

    const moveFoward = () => {
        const forwardIndex = canTwoPage ? index + 2 : index + 1;
        if (entries.length <= forwardIndex) {
            return;
        }
        setIsForward(true);
        dispatch(setImageIndex(forwardIndex));
    }
    const moveBack = () => {
        const backIndex = canTwoPage ? index - 2 : index - 1;
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
                moveFoward();
                break;
            case "ArrowRight":
                moveBack();
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
