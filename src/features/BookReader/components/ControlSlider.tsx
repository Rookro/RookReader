import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { Box, Slider, Stack, Typography } from "@mui/material";
import { createTheme, type Theme, ThemeProvider, useTheme } from "@mui/material/styles";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { type SyntheticEvent, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { prefixer } from "stylis";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { useReadingDirection } from "../hooks/useReadingDirection";
import { setImageIndex } from "../slice";

// One cache per direction for the app's lifetime: a new cache would insert its styles again.
const rtlCache = createCache({ key: "muirtl", stylisPlugins: [prefixer, rtlPlugin] });
const ltrCache = createCache({ key: "muiltr", stylisPlugins: [prefixer] });

/**
 * Control Slider Component
 */
export default function ControlSlider() {
  const { t } = useTranslation();
  const entries = useAppSelector((state) => state.reader.entries);
  const index = useAppSelector((state) => state.reader.index);
  const dispatch = useAppDispatch();
  const appTheme = useTheme();
  // Follows the novel's detected writing mode, or the comic setting.
  const isRtl = useReadingDirection() === "rtl";

  const theme = useMemo(() => {
    return createTheme(appTheme, {
      direction: isRtl ? "rtl" : "ltr",
    } as Theme);
  }, [appTheme, isRtl]);

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
      <CacheProvider value={isRtl ? rtlCache : ltrCache}>
        <ThemeProvider theme={theme}>
          <Slider
            aria-label={t("book-reader.page-slider")}
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
