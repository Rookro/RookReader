import { useEffect, useMemo, } from "react";
import { useDispatch } from "react-redux";
import { Box, CircularProgress } from "@mui/material";
import { dirname } from "@tauri-apps/api/path";
import { AppDispatch, useAppSelector } from '../../Store';
import { openContainerFile, setContainerFilePath, setExploreBasePath } from "../../reducers/FileReducer";
import { setIsFirstPageSingleView } from "../../reducers/ViewReducer";
import { settingsStore } from "../../settings/SettingsStore";
import { usePageNavigation } from "../../hooks/usePageNavigation";
import { ViewerSettings, } from "../../utils/ImageUtils";
import { useFileDrop } from "../../hooks/useFileDrop";
import { useViewerController } from "../../hooks/useViewerController";
import { setPdfRenderingHeight } from "../../bindings/ContainerCommands";

/**
 * Component for displaying images.
 */
export default function ImageViewer() {
    const dispatch = useDispatch<AppDispatch>();
    const { history, historyIndex, entries, index, isLoading: isFileLoading } = useAppSelector(state => state.file.containerFile);
    const { isTwoPagedView, direction, isFirstPageSingleView } = useAppSelector(state => state.view);
    const { droppedFile } = useFileDrop();

    const containerPath = history[historyIndex];

    const settings: ViewerSettings = useMemo(() => ({
        isTwoPagedView, isFirstPageSingleView, direction
    }), [isTwoPagedView, isFirstPageSingleView, direction]);

    const { displayedLayout, moveForward, moveBack } = useViewerController(
        containerPath,
        entries,
        index,
        isFileLoading,
        settings,
        dispatch
    );

    const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
        moveForward,
        moveBack,
        settings.direction
    );

    useEffect(() => {
        const initSettings = async () => {
            const isFirstSingle = await settingsStore.get<boolean>("first-page-single-view") ?? true;
            dispatch(setIsFirstPageSingleView(isFirstSingle));

            const height = await settingsStore.get<number>("pdf-rendering-height");
            if (height) {
                await setPdfRenderingHeight(height);
            }
        };
        initSettings();
    }, [dispatch]);

    useEffect(() => {
        if (containerPath) {
            dispatch(openContainerFile(containerPath));
        }
    }, [containerPath, dispatch]);

    useEffect(() => {
        const handleFileDroped = async () => {
            if (droppedFile && droppedFile.length > 0) {
                dispatch(setContainerFilePath(droppedFile));
                dispatch(setExploreBasePath(await dirname(droppedFile)));
            }
        }
        handleFileDroped();
    }, [droppedFile, dispatch]);

    // Loading display.
    if (isFileLoading) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!displayedLayout) {
        return (
            <Box sx={{ width: '100%', height: '100%' }} />
        );
    }

    const srcLeft = settings.direction === "ltr" ? displayedLayout.firstImage?.url : (displayedLayout.secondImage?.url || displayedLayout.firstImage?.url);
    const srcRight = settings.direction === "ltr" ? displayedLayout.secondImage?.url : displayedLayout.firstImage?.url;
    const srcSingle = displayedLayout.firstImage?.url;

    return (
        <Box
            tabIndex={0}
            onClick={handleClicked}
            onContextMenu={handleContextMenu}
            onWheel={handleWheeled}
            onKeyDown={handleKeydown}
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
            }}
        >
            {displayedLayout.isSpread ? (
                <>
                    <Box
                        component="img"
                        src={srcLeft}
                        alt="Left Page"
                        sx={{ width: '50%', height: '100%', objectPosition: 'right center', objectFit: 'contain' }}
                    />
                    <Box
                        component="img"
                        src={srcRight}
                        alt="Right Page"
                        sx={{ width: '50%', height: '100%', objectPosition: 'left center', objectFit: 'contain' }}
                    />
                </>
            ) : (
                <Box
                    component="img"
                    src={srcSingle}
                    alt="Single Page"
                    sx={{ width: '100%', height: '100%', objectPosition: 'center center', objectFit: 'contain' }}
                />
            )}
        </Box>
    );
}
