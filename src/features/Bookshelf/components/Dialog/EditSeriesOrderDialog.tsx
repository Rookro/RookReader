import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "../../../../store/store";
import type { BookWithState } from "../../../../types/DatabaseModels";
import { updateSeriesOrdersThunk } from "../../slice";
import SortableBookItem from "./SortableBookItem";

export interface EditSeriesOrderDialogProps {
  openDialog: boolean;
  books: BookWithState[];
  onClose: () => void;
}

export default function EditSeriesOrderDialog({
  openDialog,
  books,
  onClose,
}: EditSeriesOrderDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [orderedBooks, setOrderedBooks] = useState<BookWithState[]>([]);

  useEffect(() => {
    if (openDialog) {
      setOrderedBooks([...books]);
    }
  }, [openDialog, books]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedBooks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    const orderedIds = orderedBooks.map((b) => b.id);
    dispatch(updateSeriesOrdersThunk(orderedIds));
    onClose();
  };

  return (
    <Dialog open={openDialog} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("bookshelf.series.edit-order.title")}</DialogTitle>
      <DialogContent dividers sx={{ p: 1, overflowX: "hidden" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={orderedBooks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <List disablePadding>
              {orderedBooks.map((book, index) => (
                <SortableBookItem key={book.id} book={book} index={index} />
              ))}
            </List>
          </SortableContext>
        </DndContext>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.collection.cancel-button")}
        </Button>
        <Button variant="contained" onClick={handleSave}>
          {t("bookshelf.collection.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
