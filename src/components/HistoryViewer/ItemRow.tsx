import { CSSProperties, memo } from 'react';
import { ListItem, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material';
import { Folder } from '@mui/icons-material';
import { HistoryEntry } from '../../types/HistoryEntry';

/**
 * Row component for the history viewer.
 */
export const ItemRow = memo(function ItemRow({
    entry,
    index,
    selected,
    onClick,
    style
}: {
    entry: HistoryEntry;
    index: number;
    selected: boolean;
    onClick: (e: React.MouseEvent<HTMLDivElement>, entry: HistoryEntry, index: number) => void;
    style: CSSProperties | undefined
}) {
    return (
        <Tooltip
            title={
                <>
                    <Typography variant='inherit'>
                        {entry.path}
                    </Typography>
                    <Typography variant='inherit'>
                        {entry.last_opened_at}
                    </Typography>
                </>
            }
            followCursor
            placement="right-start"
        >
            <ListItem style={style} key={index} component="div" disablePadding dense>
                <ListItemButton
                    selected={selected}
                    onClick={(e) => onClick(e, entry, index)}
                    key={index}
                    sx={{ padding: '4px 8px' }}
                >
                    <ListItemText primary={entry.display_name} slotProps={{ primary: { noWrap: true } }} />
                    {entry.type === 'DIRECTORY' ? <Folder fontSize="small" /> : <></>}
                </ListItemButton>
            </ListItem>
        </Tooltip>
    );
});
