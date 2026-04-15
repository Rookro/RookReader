import { createTheme, useMediaQuery } from "@mui/material";
import { useMemo } from "react";
import { useAppSelector } from "../store/store";

/**
 * A custom hook that generates and returns a Material UI Theme object.
 *
 * The theme is dynamically created based on the user's system preference for dark/light mode
 * and the application's global font family setting stored in Redux. It also applies global
 * CSS baseline overrides, including custom scrollbar styling.
 *
 * @returns {import("@mui/material").Theme} The customized Material UI theme instance.
 */
export function useAppTheme() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const fontFamily = useAppSelector((state) => state.settings.general.appFontFamily);

  const theme = useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily: `${fontFamily}`,
        },
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
          background: {
            paper: prefersDarkMode ? "#2f2f2f" : "#f6f6f6",
          },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: (theme) => ({
              body: {
                margin: 0,
                overflow: "hidden",
                userSelect: "none",
                fontSize: "1em",
                lineHeight: 1.5,
                fontWeight: 400,
                fontSynthesis: "none",
                textRendering: "optimizeLegibility",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
                WebkitTextSizeAdjust: "100%",
                // Webkit scrollbar styles
                "*::-webkit-scrollbar": {
                  height: "10px",
                  width: "10px",
                },
                "*::-webkit-scrollbar-track": {
                  background: theme.palette.background.paper,
                  borderRadius: "6px",
                },
                "*::-webkit-scrollbar-thumb": {
                  backgroundColor: theme.palette.mode === "dark" ? "#555" : "#ccc",
                  borderRadius: "6px",
                  border: `1px solid ${theme.palette.background.paper}`,
                },
                "*::-webkit-scrollbar-thumb:hover": {
                  backgroundColor: theme.palette.mode === "dark" ? "#777" : "#aaa",
                },
                // Allotment styles
                "--separator-border": theme.palette.divider,
                "--focus-border": theme.palette.action.focus,
              },
            }),
          },
        },
      }),
    [prefersDarkMode, fontFamily],
  );

  return theme;
}
