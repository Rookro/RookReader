import { CSSProperties, memo, useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { List, RowComponentProps, useListRef } from 'react-window';
import { Box, ListItem, ListItemButton, ListItemText, Tooltip } from '@mui/material';
import { Image } from '@mui/icons-material';
import { useAppSelector, AppDispatch } from '../../Store';
import { setImageIndex } from '../../reducers/FileReducer';

/**
 * Row component for an image entry.
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
        <Tooltip title={entry} placement="right-start">
            <ListItem style={style} key={index} component="div" disablePadding dense>
                <ListItemButton
                    selected={selected}
                    onClick={(e) => onClick(e, index)}
                    key={entry}
                    sx={{
                        '&.Mui-selected': { backgroundColor: (theme) => theme.palette.action.selected },
                        '&.Mui-selected:hover': { backgroundColor: (theme) => theme.palette.action.selected },
                        '&:hover': { backgroundColor: (theme) => theme.palette.action.hover },
                    }}
                >
                    <Image />
                    <ListItemText primary={entry} slotProps={{ primary: { noWrap: true } }} sx={{ marginLeft: "5px" }} />
                </ListItemButton>
            </ListItem>
        </Tooltip >
    );
});

/** 
 * Component to display a list of image entries.
 */
export default function ImageEntriesViewer() {
    const { entries, index } = useAppSelector(state => state.file.containerFile);
    const dispatch = useDispatch<AppDispatch>();

    const [selectedIndex, setSelectedIndex] = useState(-1);

    const listRef = useListRef(null);

    useEffect(() => {
        setSelectedIndex(index);
    }, [index]);

    // Scroll to make the selected item visible.
    useEffect(() => {
        if (entries.length < 1 || selectedIndex === -1) {
            return;
        }

        listRef.current?.scrollToRow({
            align: "smart",
            behavior: "instant",
            index: selectedIndex
        });
    }, [selectedIndex, entries]);

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
                rowComponent={Row}
                rowCount={entries.length}
                rowHeight={36}
                rowProps={{ entries }}
                listRef={listRef}
            />
        </Box >
    );
}
