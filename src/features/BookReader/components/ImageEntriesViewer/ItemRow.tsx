import Image from "@mui/icons-material/Image";
import { ListItem, ListItemButton, ListItemText, Tooltip } from "@mui/material";
import { type CSSProperties, memo } from "react";
import { preventRightClickFocus } from "../../../../utils/preventRightClickFocus";
import { releaseMouseFocus } from "../../../../utils/releaseMouseFocus";

/**
 * Row component for an image entry.
 *
 * @param entry - The image entry to display.
 * @param index - The index of the entry in the list.
 * @param selected - Whether the entry is selected.
 * @param id - Optional id, which the listbox's `aria-activedescendant` points at.
 * @param keyboardActive - Whether the row is drawn as the keyboard's active row.
 * @param onClick - Optional callback for when the entry is clicked.
 * @param style - Optional CSS style for the row.
 */
export const ItemRow = memo(function ItemRow({
  entry,
  index,
  selected,
  id,
  keyboardActive,
  onClick,
  style,
}: {
  entry: string;
  index: number;
  selected: boolean;
  id?: string;
  keyboardActive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
  style?: CSSProperties;
}) {
  return (
    <Tooltip title={entry} followCursor placement="right-start">
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
            onClick?.(e, index);
          }}
          onMouseDown={preventRightClickFocus}
          key={entry}
          sx={{ padding: "4px 8px" }}
        >
          <Image fontSize="small" />
          <ListItemText
            primary={entry}
            slotProps={{ primary: { noWrap: true } }}
            sx={{ marginLeft: "5px" }}
          />
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
});
