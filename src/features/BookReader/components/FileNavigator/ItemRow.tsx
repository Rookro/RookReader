import FolderOutlined from "@mui/icons-material/FolderOutlined";
import { ListItem, ListItemButton, ListItemText, Tooltip } from "@mui/material";
import { type CSSProperties, memo } from "react";
import type { DirEntry } from "../../../../domain/entities";
import { useRowTooltip } from "../../../../hooks/useRowTooltip";
import { preventRightClickFocus } from "../../../../utils/preventRightClickFocus";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";

/**
 * Row component for the file navigator.
 *
 * @param entry - The directory entry to display.
 * @param index - The index of the entry in the list.
 * @param selected - Whether the entry is selected.
 * @param id - Optional id, which the listbox's `aria-activedescendant` points at.
 * @param keyboardActive - Whether the row is drawn as the keyboard's active row.
 * @param onClick - Optional callback for when the entry is clicked.
 * @param onDoubleClick - Optional callback for when the entry is double-clicked.
 * @param style - Optional CSS style for the row.
 */
export const ItemRow = memo(function ItemRow({
  entry,
  index,
  selected,
  id,
  keyboardActive,
  onClick,
  onDoubleClick,
  style,
}: {
  entry: DirEntry;
  index: number;
  selected: boolean;
  id?: string;
  keyboardActive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry, index: number) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>, entry: DirEntry) => void;
  style?: CSSProperties;
}) {
  const tooltip = useRowTooltip(keyboardActive === true);

  return (
    <Tooltip title={entry.name} placement="right-start" {...tooltip}>
      <ListItem style={style} key={index} component="div" role="none" disablePadding dense>
        <ListItemButton
          id={id}
          role="option"
          aria-selected={selected}
          tabIndex={-1}
          className={keyboardActive ? "Mui-focusVisible" : undefined}
          selected={selected}
          onClick={(e) => {
            releaseMouseFocus(e);
            onClick?.(e, entry, index);
          }}
          onDoubleClick={(e) => onDoubleClick?.(e, entry)}
          onMouseDown={preventRightClickFocus}
          key={entry.name}
          sx={{ padding: "4px 8px" }}
        >
          <ListItemText primary={entry.name} slotProps={{ primary: { noWrap: true } }} />
          {entry.isDirectory && <FolderOutlined fontSize="small" />}
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
});
