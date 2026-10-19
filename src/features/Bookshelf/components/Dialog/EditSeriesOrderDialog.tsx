import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List } from "@mui/material";
import { error as logError } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBooksWithStateBySeriesId } from "../../../../bindings/BookCommands";
import type { BookWithState } from "../../../../domain/book/schema";
import { useAppDispatch } from "../../../../store/store";
import { updateSeriesOrdersThunk } from "../../seriesSlice";
import { sortBySeriesOrder } from "../../utils/BookshelfUtils";
import SortableBookItem from "./SortableBookItem";

/** Props for the EditSeriesOrderDialog component. */
export interface EditSeriesOrderDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** The series whose volumes are reordered, or null when none is chosen. */
  seriesId: number | null;
  /** Called when the dialog closes. */
  onClose: () => void;
}

/**
 * Dialog for dragging the volumes of a series into reading order.
 *
 * Lists every volume of the series, not only those in the collection on screen, since
 * saving renumbers the whole list from 1.
 */
export default function EditSeriesOrderDialog({
  open,
  seriesId,
  onClose,
}: EditSeriesOrderDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // Null while loading or after a failed read: saving then would renumber volumes the
  // dialog never saw.
  const [orderedBooks, setOrderedBooks] = useState<BookWithState[] | null>(null);

  // Loaded once per opening, so a bookshelf refresh cannot discard a drag in progress.
  useEffect(() => {
    if (!open || seriesId === null) {
      return;
    }
    setOrderedBooks(null);
    let stale = false;
    getBooksWithStateBySeriesId(seriesId)
      .then((books) => {
        if (!stale) setOrderedBooks([...books].sort(sortBySeriesOrder));
      })
      .catch((e) => {
        logError(`Failed to fetch the books of series ${seriesId}: ${e}`);
      });
    return () => {
      stale = true;
    };
  }, [open, seriesId]);

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
        if (!items) return items;
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    if (!orderedBooks) return;
    const orderedIds = orderedBooks.map((b) => b.id);
    dispatch(updateSeriesOrdersThunk(orderedIds));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} slotProps={{ paper: { sx: { minWidth: "40%" } } }}>
      <DialogTitle>{t("bookshelf.series.edit-order.title")}</DialogTitle>
      <DialogContent sx={{ padding: 1, overflowX: "hidden" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
        >
          <SortableContext
            items={(orderedBooks ?? []).map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <List disablePadding>
              {(orderedBooks ?? []).map((book, index) => (
                <SortableBookItem key={book.id} book={book} index={index} />
              ))}
            </List>
          </SortableContext>
        </DndContext>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 3 }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>
          {t("bookshelf.collection.cancel-button")}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={!orderedBooks}>
          {t("bookshelf.collection.ok-button")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
