import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Box, List, ListItemButton, ListItemText } from '@mui/material';
import { Image } from '@mui/icons-material';
import { useSelector, AppDispatch } from '../../Store';
import { setImageIndex } from '../../reducers/FileReducer';
import "./ImageEntriesViewer.css";


/**
 * 画像エントリーの行コンポーネント
 */
const ItemRow = memo(function ItemRow({
    entry,
    index,
    selected,
    onFocus,
    // onClick,
    // onDoubleClick,
    refCallback,
}: {
    entry: string;
    index: number;
    selected: boolean;
    onFocus: (e: React.FocusEvent, i: number) => void;
    refCallback: (el: HTMLDivElement | null) => void;
}) {
    return (
        <ListItemButton
            selected={selected}
            onFocus={(e) => onFocus(e, index)}
            key={entry}
            ref={refCallback}
        >
            <Image />
            <ListItemText primary={entry} sx={{ marginLeft: "5px" }} />
        </ListItemButton>
    );
});

/** 
 * ファイルリスト表示コンポネント 
 */
function ImageEntriesViewer() {
    const { entries, index } = useSelector(state => state.file.containerFile);
    const dispatch = useDispatch<AppDispatch>();

    const [selectedIndex, setSelectedIndex] = useState(index);

    const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

    useEffect(() => {
        setSelectedIndex(index);
    }, [index]);

    // 選択している項目が表示されるようにスクロールする
    useEffect(() => {
        const selectedItemRef = itemRefs.current[selectedIndex];
        if (selectedItemRef) {
            selectedItemRef.scrollIntoView({
                behavior: 'instant',
                block: 'nearest',
            });
        }
    }, [selectedIndex, index]);

    const handleListItemFocused = useCallback(
        (_e: React.FocusEvent, index: number) => {
            setSelectedIndex(index);
            dispatch(setImageIndex(index));
        },
        [dispatch]
    );

    return (
        <Box sx={{ width: "100%", height: "100%", display: 'grid', alignContent: 'start' }}>
            <List className="file_list" component="nav" dense={true} disablePadding={true}>
                {entries.map((entry, index) =>
                    <ItemRow
                        key={entry}
                        entry={entry}
                        index={index}
                        selected={selectedIndex === index}
                        onFocus={handleListItemFocused}
                        refCallback={(el: HTMLDivElement | null) => { itemRefs.current[index] = el; }}
                    />
                )}
            </List>
        </Box >
    );
}

export default ImageEntriesViewer;
