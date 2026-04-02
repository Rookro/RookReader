import { CSSProperties, memo } from "react";
import { ListItem, ListItemButton, ListItemText, Tooltip } from "@mui/material";
import { FolderOutlined } from "@mui/icons-material";
import { DirEntry } from "../../../../types/DirEntry";

/**
 * Row component for the file navigator.
 *
 * @param entry - The directory entry to display.
 * @param index - The index of the entry in the list.
 * @param selected - Whether the entry is selected.
 * @param onClick - Optional callback for when the entry is clicked.
 * @param onDoubleClick - Optional callback for when the entry is double-clicked.
 * @param style - Optional CSS style for the row.
 */
export const ItemRow = memo(function ItemRow({
  entry,
  index,
  selected,
  onClick,
  onDoubleClick,
  style,
}: {
  entry: DirEntry;
  index: number;
  selected: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => void;
  style?: CSSProperties;
}) {
  return (
    <Tooltip title={entry.name} followCursor placement="right-start">
      <ListItem style={style} key={index} component="div" disablePadding dense>
        <ListItemButton
          selected={selected}
          onClick={(e) => onClick?.(e, entry, index)}
          onDoubleClick={(e) => onDoubleClick?.(e, entry)}
          key={entry.name}
          sx={{ padding: "4px 8px" }}
        >
          <ListItemText primary={entry.name} slotProps={{ primary: { noWrap: true } }} />
          {entry.is_directory ? <FolderOutlined fontSize="small" /> : <></>}
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
});
