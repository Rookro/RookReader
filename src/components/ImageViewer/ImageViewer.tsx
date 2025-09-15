import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSelector } from '../../Store';
import "./ImageViewer.css";

/**
 * 画像ファイルを読み込み、`<img>` 用の URL を作成する
 * 
 * @param path 画像パス
 * @returns 画像BlobのURL
 */
const createImageURL = async (containerPath: string, entryName: string) => {
    if (!containerPath || !entryName || containerPath.length === 0 || entryName.length === 0) {
        return "";
    }
    const binary = await invoke<number[]>("get_binary", { zipPath: containerPath, entryName });
    const blob = new Blob([new Uint8Array(binary)]);
    return URL.createObjectURL(blob);
}

/**
 * 画像表示用コンポーネント
 */
function ImageViewer() {
    const { containerPath, entries } = useSelector(state => state.file);
    const { isTwoPagedView, direction } = useSelector(state => state.view);

    const [index, setIndex] = useState(0);
    const [firstSrc, setFirstSrc] = useState("");
    const [secondSrc, setSecondSrc] = useState("");
    const [canTwoPage, setCanTwoPage] = useState(false);

    useEffect(() => { setIndex(0) }, [containerPath]);

    useEffect(() => {
        const setImage = async (firstImagePath: string, secondImagePath: string | undefined) => {
            if (firstSrc.length > 0) {
                URL.revokeObjectURL(firstSrc);
            }
            if (secondSrc.length > 0) {
                URL.revokeObjectURL(secondSrc);
            }
            const imgSrc = await createImageURL(containerPath, firstImagePath);
            setFirstSrc(imgSrc);
            if (isTwoPagedView && secondImagePath) {
                const imgSrc = await createImageURL(containerPath, secondImagePath);
                setSecondSrc(imgSrc);
                setCanTwoPage(true);
            } else {
                setSecondSrc("");
                setCanTwoPage(false);
            }
        }
        let nextPath: string | undefined = undefined;
        if (entries.length > index + 1) {
            nextPath = entries[index + 1];
        }
        setImage(entries[index], nextPath);
    }, [containerPath, entries, index, isTwoPagedView]);

    const moveFoward = () => {
        const forwardIndex = isTwoPagedView ? index + 2 : index + 1;
        if (entries.length <= forwardIndex) {
            return;
        }
        setIndex(forwardIndex);
    }
    const moveBack = () => {
        const backIndex = isTwoPagedView ? index - 2 : index - 1;
        if (backIndex < 0) {
            setIndex(0);
            return;
        }
        setIndex(backIndex);
    }

    const handleClicked = (_e: React.MouseEvent<HTMLDivElement>) => {
        // 左クリック
        moveFoward();
    }

    const handleContextMenu = (_e: React.MouseEvent<HTMLDivElement>) => {
        // 右クリック
        moveBack();
    }

    return (
        <div className="image_viewer" onClick={handleClicked} onContextMenu={handleContextMenu}>
            {(isTwoPagedView && canTwoPage) ?
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
