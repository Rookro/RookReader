import { useMemo } from "react";
import { prefixer } from 'stylis';
import { Box, Slider, Stack, Typography } from '@mui/material';
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { CacheProvider } from "@emotion/react";
import createCache from '@emotion/cache';
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAppDispatch, useAppSelector } from '../../Store';
import { setImageIndex } from '../../reducers/FileReducer';

/**
 * Control Slider Component
 */
export default function ControlSlider() {
    const { entries, index } = useAppSelector(state => state.file.containerFile);
    const { direction } = useAppSelector(state => state.view);
    const dispatch = useAppDispatch();
    const appTheme = useAppTheme();

    const cache = useMemo(() => {
        const isRtl = direction === "rtl";
        return createCache({
            key: isRtl ? 'muirtl' : 'muiltr',
            stylisPlugins: isRtl ? [prefixer, rtlPlugin] : [prefixer],
        });
    }, [direction]);

    const theme = useMemo(() => {
        const isRtl = direction === "rtl";
        return createTheme(appTheme, {
            direction: isRtl ? 'rtl' : 'ltr',
        } as Theme);
    }, [appTheme, direction]);

    const handleSliderValueChanged = (_event: Event, value: number, _activeThumb: number) => {
        dispatch(setImageIndex(value));
    }

    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: "center",
                alignItems: "center",
                margin: "2px 2px 2px 20px",
            }}>
            <CacheProvider value={cache}>
                <ThemeProvider theme={theme}>
                    <Slider value={index} defaultValue={1} step={1} min={0} max={entries.length - 1} onChange={handleSliderValueChanged} disabled={entries.length === 0} />
                    <Box sx={{
                        width: 'auto',
                        minWidth: '5em',
                        marginLeft: '10px',
                        marginRight: '10px',
                    }}>
                        <Typography align='right'>{entries.length === 0 ? 0 : index + 1}/{entries.length}</Typography>
                    </Box>
                </ThemeProvider>
            </CacheProvider>
        </Stack >
    );
}
