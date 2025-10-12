import "./ControlSlider.css";
import { Slider, Typography } from '@mui/material';
import { AppDispatch, useSelector } from '../../Store';
import { useDispatch } from 'react-redux';
import { setImageIndex } from '../../reducers/FileReducer';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { CacheProvider } from "@emotion/react";

// RTL表示用
const rtlTheme = createTheme({
    direction: 'rtl',
});
const rtlCache = createCache({
    key: 'muirtl',
    stylisPlugins: [prefixer, rtlPlugin],
});

// LTR表示用
const ltrTheme = createTheme({
    direction: 'ltr',
});
const lrtCache = createCache({
    key: 'muiltr',
    stylisPlugins: [prefixer],
});

/**
 * スライダー
 */
function ControlSlider() {
    const { entries, index } = useSelector(state => state.file.containerFile);
    const { direction } = useSelector(state => state.view);
    const dispatch = useDispatch<AppDispatch>();

    const handleSliderValueChanged = (_event: Event, value: number, _activeThumb: number) => {
        dispatch(setImageIndex(value));
    }

    return (
        <div className="control_slider">
            <CacheProvider value={direction === "left" ? lrtCache : rtlCache}>
                <ThemeProvider theme={direction === "left" ? ltrTheme : rtlTheme}>
                    <Slider dir={direction === "left" ? "ltr" : "rtl"} value={index} defaultValue={1} step={1} min={0} max={entries.length - 1} onChange={handleSliderValueChanged} disabled={entries.length === 0} />
                    <div className="slider_output"><Typography align='right'>{entries.length === 0 ? 0 : index + 1}/{entries.length}</Typography></div>
                </ThemeProvider>
            </CacheProvider>
        </div>
    );
}

export default ControlSlider;
