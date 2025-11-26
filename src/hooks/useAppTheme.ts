import { useMemo } from "react";
import { createTheme, useMediaQuery } from "@mui/material";

export function useAppTheme() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = useMemo(() => createTheme({
        palette: {
            mode: prefersDarkMode ? 'dark' : 'light'
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        margin: 0,
                        overflow: 'hidden',
                        fontFamily: '"Noto Sans CJK JP", "Noto Sans JP"',
                        fontSize: '1em',
                        lineHeight: 1.5,
                        fontWeight: 400,
                        fontSynthesis: 'none',
                        textRendering: 'optimizeLegibility',
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                        WebkitTextSizeAdjust: '100%',
                    },
                }
            }
        },
    }), [prefersDarkMode]);

    return theme;
}
