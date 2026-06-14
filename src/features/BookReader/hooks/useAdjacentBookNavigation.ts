import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "../../../components/ui/Notification/NotificationContext";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { setContainerFilePath, setOpenOrigin, setPendingInitialPosition } from "../slice";
import {
  type AdjacentBook,
  type Direction,
  resolveAdjacentBook,
} from "../utils/AdjacentBookResolver";

/** A pending adjacent-book transition awaiting user confirmation ("ask" mode). */
interface PendingAdjacentBook {
  book: AdjacentBook;
  direction: Direction;
}

/**
 * Hook that opens the next/previous book when the user pages past the last/first page.
 *
 * Returns boundary callbacks to wire into the viewer, plus the confirm-dialog state for
 * the "ask" mode. The behavior is controlled by the `reader.autoOpenAdjacentBook`
 * setting ("off" | "ask" | "auto").
 */
export const useAdjacentBookNavigation = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { showNotification } = useNotification();

  const mode = useAppSelector((s: RootState) => s.settings.reader.autoOpenAdjacentBook);
  const fileNavigatorSortOrder = useAppSelector(
    (s: RootState) => s.settings.fileNavigator.sortOrder,
  );
  const containerFile = useAppSelector((s: RootState) => s.read.containerFile);

  const isResolving = useRef(false);
  const [pending, setPending] = useState<PendingAdjacentBook | null>(null);

  const openBook = useCallback(
    (book: AdjacentBook, direction: Direction) => {
      // Previous-book navigation should land on the last page of that book.
      if (direction === "previous") {
        dispatch(setPendingInitialPosition("last"));
      }
      // Preserve the current origin so the series/bookshelf/directory chain continues.
      dispatch(setOpenOrigin(containerFile.origin));
      dispatch(setContainerFilePath(book.filePath));
      showNotification(
        t(
          direction === "next"
            ? "book-reader.adjacent-book.opening-next"
            : "book-reader.adjacent-book.opening-previous",
          { title: book.displayName },
        ),
        "info",
      );
    },
    [dispatch, containerFile.origin, showNotification, t],
  );

  const trigger = useCallback(
    async (direction: Direction) => {
      if (mode === "off" || isResolving.current || pending) {
        return;
      }
      isResolving.current = true;
      try {
        const currentPath = containerFile.history[containerFile.historyIndex] ?? "";
        const book = await resolveAdjacentBook(
          containerFile.book,
          currentPath,
          containerFile.origin,
          direction,
          fileNavigatorSortOrder,
        );
        if (!book) {
          showNotification(
            t(
              direction === "next"
                ? "book-reader.adjacent-book.no-next"
                : "book-reader.adjacent-book.no-previous",
            ),
            "info",
          );
          return;
        }
        if (mode === "ask") {
          setPending({ book, direction });
        } else {
          openBook(book, direction);
        }
      } finally {
        isResolving.current = false;
      }
    },
    [mode, pending, containerFile, fileNavigatorSortOrder, showNotification, t, openBook],
  );

  const onForwardBoundary = useCallback(() => {
    void trigger("next");
  }, [trigger]);

  const onBackwardBoundary = useCallback(() => {
    void trigger("previous");
  }, [trigger]);

  const confirmPending = useCallback(() => {
    if (pending) {
      openBook(pending.book, pending.direction);
    }
    setPending(null);
  }, [pending, openBook]);

  const cancelPending = useCallback(() => {
    setPending(null);
  }, []);

  return { onForwardBoundary, onBackwardBoundary, pending, confirmPending, cancelPending };
};
