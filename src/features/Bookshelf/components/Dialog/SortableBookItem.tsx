import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragIndicator } from "@mui/icons-material";
import { Avatar, Box, IconButton, ListItem, ListItemAvatar, ListItemText } from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import dummy_thumbnail from "../../../../assets/dummy_thumbnail.svg";
import type { BookWithState } from "../../../../types/DatabaseModels";

export interface SortableBookItemProps {
  book: BookWithState;
  index: number;
}

export default function SortableBookItem({ book, index }: SortableBookItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    backgroundColor: isDragging ? "action.hover" : "background.paper",
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        mb: 1,
      }}
      secondaryAction={
        <Box {...attributes} {...listeners} sx={{ display: "flex", alignItems: "center" }}>
          <IconButton sx={{ cursor: "grab" }} disableRipple>
            <DragIndicator />
          </IconButton>
        </Box>
      }
    >
      <ListItemAvatar>
        <Avatar
          variant="rounded"
          src={book?.thumbnail_path ? convertFileSrc(book.thumbnail_path) : dummy_thumbnail}
          sx={{ width: 40, height: 56 }}
        >
          {!book.thumbnail_path && book.display_name.charAt(0)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={book.display_name}
        secondary={`# ${index + 1}`}
        primaryTypographyProps={{
          noWrap: true,
          title: book.display_name,
        }}
      />
    </ListItem>
  );
}
