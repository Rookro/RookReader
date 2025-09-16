import "./ControlSlider.css";
import { Slider, Typography } from '@mui/material';
import { AppDispatch, useSelector } from '../../Store';
import { useDispatch } from 'react-redux';
import { setImageIndex } from '../../reducers/FileReducer';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// RTL表示にしたい場合
const rtlTheme = createTheme({
    direction: 'rtl',
});

const ltrTheme = createTheme({
    direction: 'ltr',
});


/**
 * スライダー
 */
function ControlSlider() {
    const { entries, index } = useSelector(state => state.file);
    const { direction } = useSelector(state => state.view);
    const dispatch = useDispatch<AppDispatch>();

    const handleValueChanged = (_event: Event, value: number, _activeThumb: number) => {
        dispatch(setImageIndex(value - 1));
    }

    return (
        <div className="control_slider">
            <ThemeProvider theme={direction === "left" ? ltrTheme : rtlTheme}>
                <Slider value={index + 1} defaultValue={1} step={1} min={1} max={entries.length} onChange={handleValueChanged} disabled={entries.length === 0} />
                <div className="slider_output"><Typography align='right'>{index + 1}/{entries.length}</Typography></div>
            </ThemeProvider>
        </div>
    );
}

export default ControlSlider;
