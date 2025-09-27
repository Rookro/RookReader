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
    const { entries, index } = useSelector(state => state.file.containerFile);
    const { direction } = useSelector(state => state.view);
    const dispatch = useDispatch<AppDispatch>();

    const handleSliderValueChanged = (_event: Event, value: number, _activeThumb: number) => {
        dispatch(setImageIndex(value));
    }

    return (
        <div className="control_slider">
            <ThemeProvider theme={direction === "left" ? ltrTheme : rtlTheme}>
                <Slider value={index} defaultValue={1} step={1} min={0} max={entries.length - 1} onChange={handleSliderValueChanged} disabled={entries.length === 0} />
                <div className="slider_output"><Typography align='right'>{entries.length === 0 ? 0 : index + 1}/{entries.length}</Typography></div>
            </ThemeProvider>
        </div>
    );
}

export default ControlSlider;
