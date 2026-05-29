import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { Box, Slider, Stack, Typography } from "@mui/material";
import { createTheme, type Theme, ThemeProvider } from "@mui/material/styles";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { type SyntheticEvent, useCallback, useMemo } from "react";
import { prefixer } from "stylis";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { setImageIndex } from "../slice";

/**
 * Control Slider Component
 */
export default function ControlSlider() {
  const entries = useAppSelector((state) => state.read.containerFile.entries);
  const index = useAppSelector((state) => state.read.containerFile.index);
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();
  const appTheme = useAppTheme();

  const cache = useMemo(() => {
    const isRtl = readerSettings.comic.readingDirection === "rtl";
    return createCache({
      key: isRtl ? "muirtl" : "muiltr",
      stylisPlugins: isRtl ? [prefixer, rtlPlugin] : [prefixer],
    });
  }, [readerSettings.comic.readingDirection]);

  const theme = useMemo(() => {
    const isRtl = readerSettings.comic.readingDirection === "rtl";
    return createTheme(appTheme, {
      direction: isRtl ? "rtl" : "ltr",
    } as Theme);
  }, [appTheme, readerSettings.comic.readingDirection]);

  const handleSliderValueChanged = useCallback(
    (_event: Event, value: number, _activeThumb: number) => {
      dispatch(setImageIndex(value));
    },
    [dispatch],
  );

  const handleSliderChangeCommitted = useCallback(
    (_event: SyntheticEvent | Event, _value: number | number[]) => {
      // Blur the slider element once the user finishes interacting with it (dragging or clicking).
      // This is crucial to release focus from the Slider component. If focus remains on the Slider,
      // subsequent left/right keyboard arrow key presses are intercepted by the Slider to change its
      // value by its step size (1 page at a time), which bypasses the reader's correct keyboard navigation
      // logic (e.g. 2-page navigation in spread mode). Blurring allows the window keydown listener
      // to handle subsequent keyboard events correctly.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [],
  );

  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: "center",
        alignItems: "center",
        margin: "2px 2px 2px 20px",
      }}
    >
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <Slider
            value={index}
            defaultValue={1}
            step={1}
            min={0}
            max={entries.length - 1}
            onChange={handleSliderValueChanged}
            onChangeCommitted={handleSliderChangeCommitted}
            disabled={entries.length === 0}
            data-testid="control-slider"
          />
          <Box
            sx={{
              width: "auto",
              minWidth: "5em",
              marginLeft: "10px",
              marginRight: "10px",
            }}
          >
            <Typography align="right" aria-label="page-indicator">
              {entries.length === 0 ? 0 : index + 1}/{entries.length}
            </Typography>
          </Box>
        </ThemeProvider>
      </CacheProvider>
    </Stack>
  );
}
