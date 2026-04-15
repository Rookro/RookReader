import { Image } from "@mui/icons-material";
import { ListItem, ListItemButton, ListItemText, Tooltip } from "@mui/material";
import { type CSSProperties, memo } from "react";

/**
 * Row component for an image entry.
 *
 * @param entry - The image entry to display.
 * @param index - The index of the entry in the list.
 * @param selected - Whether the entry is selected.
 * @param onClick - Optional callback for when the entry is clicked.
 * @param style - Optional CSS style for the row.
 */
export const ItemRow = memo(function ItemRow({
  entry,
  index,
  selected,
  onClick,
  style,
}: {
  entry: string;
  index: number;
  selected: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>, index: number) => void;
  style?: CSSProperties;
}) {
  return (
    <Tooltip title={entry} followCursor placement="right-start">
      <ListItem style={style} key={index} component="div" disablePadding dense>
        <ListItemButton
          selected={selected}
          onClick={(e) => onClick?.(e, index)}
          key={entry}
          sx={{
            padding: "4px 8px",
            "&.Mui-selected": { backgroundColor: (theme) => theme.palette.action.selected },
            "&.Mui-selected:hover": { backgroundColor: (theme) => theme.palette.action.selected },
            "&:hover": { backgroundColor: (theme) => theme.palette.action.hover },
          }}
        >
          <Image />
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
