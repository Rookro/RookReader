import { CSSProperties, memo, useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { List, RowComponentProps, useListRef } from 'react-window';
import { Box, ListItemButton, ListItemText } from '@mui/material';
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
    onClick,
    style
}: {
    entry: string;
    index: number;
    selected: boolean;
    onClick: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
    style: CSSProperties | undefined
}) {
    return (
        <ListItemButton
            selected={selected}
            onClick={(e) => onClick(e, index)}
            key={entry}
            style={style}
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

    const [selectedIndex, setSelectedIndex] = useState(0);

    const listRef = useListRef(null);

    useEffect(() => {
        setSelectedIndex(index);
    }, [index]);

    // 選択している項目が表示されるようにスクロールする
    useEffect(() => {
        if (entries.length < 1) {
            return;
        }
        const list = listRef.current;
        list?.scrollToRow({
            align: "auto",
            behavior: "instant",
            index: selectedIndex
        });
    }, [selectedIndex, index, listRef.current]);

    const handleListItemClicked = useCallback(
        (_e: React.MouseEvent<HTMLDivElement>, index: number) => {
            setSelectedIndex(index);
            dispatch(setImageIndex(index));
        },
        [dispatch]
    );

    const Row = ({
        index,
        entries,
        style
    }: RowComponentProps<{
        entries: string[];
    }>) => {
        const entry = entries[index];
        return (
            <ItemRow
                key={entry}
                entry={entry}
                index={index}
                selected={selectedIndex === index}
                onClick={handleListItemClicked}
                style={style}
            />
        );
    }

    return (
        <Box sx={{ width: "100%", height: "100%", display: 'grid', alignContent: 'start' }}>
            <List
                className="file_list"
                rowComponent={Row}
                rowCount={entries.length}
                rowHeight={48}
                rowProps={{ entries }}
                listRef={listRef}
            />
        </Box >
    );
}

export default ImageEntriesViewer;
