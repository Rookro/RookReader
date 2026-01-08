import { CSSProperties, memo, useCallback, useState } from 'react';
import { Box, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { FolderOutlined } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { HistoryEntry } from '../../types/HistoryEntry';
import { useAppDispatch } from '../../Store';
import { deleteHistory } from '../../reducers/HistoryReducer';

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
    onClick?: (e: React.MouseEvent<HTMLElement>, entry: HistoryEntry, index: number) => void;
    style: CSSProperties | undefined
}) {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; } | null>(null);

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();

        setContextMenu(
            contextMenu === null ?
                {
                    mouseX: event.clientX,
                    mouseY: event.clientY,
                }
                : null,
        );
    };

    const handleMenuClosed = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleOpenClicked = useCallback((e: React.MouseEvent<HTMLElement>, entry: HistoryEntry, index: number) => {
        setContextMenu(null);
        onClick?.(e, entry, index);
    }, []);

    const handleRemoveClicked = useCallback(async (_e: React.MouseEvent<HTMLElement>, entry: HistoryEntry, _index: number) => {
        setContextMenu(null);
        dispatch(deleteHistory(entry.id));
    }, [entry.id]);

    return (
        <Box component='div' onContextMenu={handleContextMenu} >
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
                        onClick={(e) => onClick?.(e, entry, index)}
                        key={index}
                        sx={{ padding: '4px 8px' }}
                    >
                        <ListItemText primary={entry.display_name} slotProps={{ primary: { noWrap: true } }} />
                        {entry.type === 'DIRECTORY' ? <FolderOutlined fontSize='small' /> : <></>}
                    </ListItemButton>
                </ListItem>
            </Tooltip>
            <Menu
                open={contextMenu !== null}
                onClose={handleMenuClosed}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
                slotProps={{ list: { dense: true } }}
            >
                <MenuItem onClick={(e) => handleOpenClicked(e, entry, index)}>
                    {t("app.history-viewer.menu.open")}
                </MenuItem>
                <MenuItem onClick={(e) => handleRemoveClicked(e, entry, index)}>
                    {t("app.history-viewer.menu.remove")}
                </MenuItem>
            </Menu>
        </Box>
    );
});
