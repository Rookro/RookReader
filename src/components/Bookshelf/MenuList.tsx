import { Add, AutoStories, LocalOffer, QuestionMark, MenuBook, Delete } from "@mui/icons-material";
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { setActiveView } from "../../reducers/ViewReducer";
import { useAppDispatch, useAppSelector } from "../../Store";
import { BookShelfIcons } from "./BookshelfIcons";
import {
  changeBookshelf,
  setSelectedTag,
  removeBookshelf,
  removeTag,
} from "../../reducers/BookCollectionReducer";

/** Props for the MenuList of bookshelf component */
export interface MenuListProps {
  /** Callback for clicking the menu item to add a bookshelf */
  onClickAddBookshelf: () => void;
  /** Callback for clicking the menu item to add a book tag */
  onClickAddBookTag: () => void;
}

/** Menu list of bookshelf component */
export default function MenuList({ onClickAddBookshelf, onClickAddBookTag }: MenuListProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { bookshelves, selectedId: selectedBookshelfId } = useAppSelector(
    (state) => state.bookCollection.bookshelf,
  );
  const { tags, selectedId: selectedTagId } = useAppSelector((state) => state.bookCollection.tag);

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    type: "bookshelf" | "tag";
    id: number;
  } | null>(null);

  const handleReturnToReaderClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(setActiveView("reader"));
    },
    [dispatch],
  );

  const handleBookshelfClicked = useCallback(
    (id: number | null) => {
      dispatch(changeBookshelf(id));
    },
    [dispatch],
  );

  const handleTagClicked = useCallback(
    (id: number | null) => {
      dispatch(setSelectedTag(selectedTagId === id ? null : id));
    },
    [dispatch, selectedTagId],
  );

  const handleContextMenu = (event: React.MouseEvent, type: "bookshelf" | "tag", id: number) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX,
            mouseY: event.clientY,
            type,
            id,
          }
        : null,
    );
  };

  const handleClose = () => {
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (contextMenu) {
      if (contextMenu.type === "bookshelf") {
        dispatch(removeBookshelf(contextMenu.id));
      } else if (contextMenu.type === "tag") {
        dispatch(removeTag(contextMenu.id));
      }
    }
    handleClose();
  };

  return (
    <Stack direction="column" sx={{ width: "100%", height: "100%" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
        }}
      >
        <Tooltip title={t("bookshelf.return-to-reader")} color="primary">
          <IconButton onClick={handleReturnToReaderClicked} aria-label="book-reader">
            <AutoStories />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            justifyContent: "center",
            paddingRight: 5,
          }}
        >
          <Typography variant="h6">{t("bookshelf.title")}</Typography>
        </Box>
      </Stack>
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Divider />
        <List
          dense
          subheader={
            <ListSubheader
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingRight: 1,
              }}
            >
              <Typography variant="body1">{t("bookshelf.collection.title")}</Typography>
              <IconButton
                edge="end"
                size="small"
                onClick={onClickAddBookshelf}
                sx={{ color: "text.secondary" }}
              >
                <Add />
              </IconButton>
            </ListSubheader>
          }
          sx={{ height: "50%", overflow: "auto" }}
        >
          <Tooltip title={t("bookshelf.collection.all-books")} followCursor placement="right-start">
            <ListItem disablePadding>
              <ListItemButton
                selected={selectedBookshelfId === null}
                onClick={() => handleBookshelfClicked(null)}
              >
                <ListItemIcon sx={{ minWidth: "auto", marginRight: "12px" }}>
                  <MenuBook />
                </ListItemIcon>
                <ListItemText primary={t("bookshelf.collection.all-books")} />
              </ListItemButton>
            </ListItem>
          </Tooltip>
          {bookshelves.map((item) => (
            <Tooltip key={item.id} title={item.name} followCursor placement="right-start">
              <ListItem disablePadding key={item.id}>
                <ListItemButton
                  selected={selectedBookshelfId === item.id}
                  onClick={() => handleBookshelfClicked(item.id)}
                  onContextMenu={(e) => handleContextMenu(e, "bookshelf", item.id)}
                >
                  <ListItemIcon sx={{ minWidth: "auto", marginRight: "12px" }}>
                    {BookShelfIcons.find((icon) => icon.key === item.icon_id)?.icon ?? (
                      <QuestionMark />
                    )}
                  </ListItemIcon>
                  <ListItemText primary={item.name} slotProps={{ primary: { noWrap: true } }} />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          ))}
        </List>
        <Divider />
        <List
          dense
          subheader={
            <ListSubheader
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingRight: 1,
              }}
            >
              <Typography variant="body1">{t("bookshelf.tag.title")}</Typography>
              <IconButton
                edge="end"
                size="small"
                onClick={onClickAddBookTag}
                sx={{ color: "text.secondary" }}
              >
                <Add />
              </IconButton>
            </ListSubheader>
          }
          sx={{ height: "50%", overflow: "auto" }}
        >
          {tags.map((item) => (
            <Tooltip key={item.id} title={item.name} followCursor placement="right-start">
              <ListItem disablePadding key={item.id}>
                <ListItemButton
                  selected={selectedTagId === item.id}
                  onClick={() => handleTagClicked(item.id)}
                  onContextMenu={(e) => handleContextMenu(e, "tag", item.id)}
                >
                  <ListItemIcon sx={{ minWidth: "auto", marginRight: "12px" }}>
                    <LocalOffer sx={{ color: item.color_code }} />
                  </ListItemIcon>
                  <ListItemText primary={item.name} slotProps={{ primary: { noWrap: true } }} />
                </ListItemButton>
              </ListItem>
            </Tooltip>
          ))}
        </List>
      </Box>
      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        <MenuItem dense onClick={handleDelete}>
          <ListItemIcon>
            <Delete color="error" />
          </ListItemIcon>
          <ListItemText>{t("bookshelf.delete")}</ListItemText>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
