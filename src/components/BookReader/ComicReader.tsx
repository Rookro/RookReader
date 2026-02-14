import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { Box, CircularProgress } from "@mui/material";
import { AppDispatch, useAppSelector } from "../../Store";
import { usePageNavigation } from "../../hooks/usePageNavigation";
import { ViewerSettings } from "../../utils/ImageUtils";
import { useViewerController } from "../../hooks/useViewerController";

/**
 * Component for displaying images of comics.
 */
export default function ComicReader() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    history,
    historyIndex,
    entries,
    index,
    isLoading: isFileLoading,
  } = useAppSelector((state) => state.file.containerFile);
  const { isTwoPagedView, direction, isFirstPageSingleView, enablePreview } = useAppSelector(
    (state) => state.view,
  );

  const containerPath = history[historyIndex];

  const settings: ViewerSettings = useMemo(
    () => ({
      isTwoPagedView,
      isFirstPageSingleView,
      direction,
      enablePreview,
    }),
    [isTwoPagedView, isFirstPageSingleView, direction, enablePreview],
  );

  const { displayedLayout, moveForward, moveBack } = useViewerController(
    containerPath,
    entries,
    index,
    settings,
    dispatch,
  );

  const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
    moveForward,
    moveBack,
    settings.direction,
  );

  // Loading display.
  if (isFileLoading) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!displayedLayout) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
        }}
      />
    );
  }

  const srcLeft =
    settings.direction === "ltr"
      ? displayedLayout.firstImage?.url
      : displayedLayout.secondImage?.url || displayedLayout.firstImage?.url;
  const srcRight =
    settings.direction === "ltr"
      ? displayedLayout.secondImage?.url
      : displayedLayout.firstImage?.url;
  const srcSingle = displayedLayout.firstImage?.url;

  return (
    <Box
      tabIndex={0}
      onClick={handleClicked}
      onContextMenu={handleContextMenu}
      onWheel={handleWheeled}
      onKeyDown={handleKeydown}
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >
      {displayedLayout.isSpread ? (
        <>
          <Box
            component="img"
            src={srcLeft}
            alt="Left Page"
            sx={{
              width: "50%",
              height: "100%",
              objectPosition: "right center",
              objectFit: "contain",
            }}
          />
          <Box
            component="img"
            src={srcRight}
            alt="Right Page"
            sx={{
              width: "50%",
              height: "100%",
              objectPosition: "left center",
              objectFit: "contain",
            }}
          />
        </>
      ) : (
        <Box
          component="img"
          src={srcSingle}
          alt="Single Page"
          sx={{
            width: "100%",
            height: "100%",
            objectPosition: "center center",
            objectFit: "contain",
          }}
        />
      )}
    </Box>
  );
}
