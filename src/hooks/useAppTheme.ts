import { useMemo } from "react";
import { createTheme, useMediaQuery } from "@mui/material";

export function useAppTheme() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = useMemo(() => createTheme({
        palette: {
            mode: prefersDarkMode ? 'dark' : 'light',
            background: {
                paper: prefersDarkMode ? '#2f2f2f' : '#f6f6f6',
            },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: (theme) => ({
                    body: {
                        margin: 0,
                        overflow: 'hidden',
                        userSelect: 'none',
                        fontFamily: '"Noto Sans CJK JP", "Noto Sans JP"',
                        fontSize: '1em',
                        lineHeight: 1.5,
                        fontWeight: 400,
                        fontSynthesis: 'none',
                        textRendering: 'optimizeLegibility',
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                        WebkitTextSizeAdjust: '100%',
                        // Webkit scrollbar styles
                        '*::-webkit-scrollbar': {
                            width: '10px'
                        },
                        '*::-webkit-scrollbar-track': {
                            background: theme.palette.background.paper,
                            borderRadius: '6px',
                        },
                        '*::-webkit-scrollbar-thumb': {
                            backgroundColor: theme.palette.mode === 'dark' ? '#555' : '#ccc',
                            borderRadius: '6px',
                            border: `1px solid ${theme.palette.background.paper}`,
                        },
                        '*::-webkit-scrollbar-thumb:hover': {
                            backgroundColor: theme.palette.mode === 'dark' ? '#777' : '#aaa',
                        },
                    },
                }),
            },
        },
    }), [prefersDarkMode]);

    return theme;
}
