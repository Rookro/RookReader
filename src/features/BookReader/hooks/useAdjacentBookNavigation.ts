import { error } from "@tauri-apps/plugin-log";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "../../../components/ui/Notification/NotificationContext";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { openBook, setPendingInitialPosition } from "../slice";
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
  // Only what resolving a neighbour needs, each selected on its own: selecting the whole
  // `containerFile` re-rendered the reader, and rebuilt every callback below, on each page turn.
  const currentPath = useAppSelector(
    (s: RootState) => s.read.containerFile.history[s.read.containerFile.historyIndex] ?? "",
  );
  const book = useAppSelector((s: RootState) => s.read.containerFile.book);
  const origin = useAppSelector((s: RootState) => s.read.containerFile.origin);

  const isResolving = useRef(false);
  const [pending, setPending] = useState<PendingAdjacentBook | null>(null);

  const openAdjacentBook = useCallback(
    (book: AdjacentBook, direction: Direction) => {
      // Land on a natural entry point of the adjacent book: the first page when moving
      // forward, the last page when moving backward.
      dispatch(setPendingInitialPosition(direction === "next" ? "first" : "last"));
      // Preserve the current origin so the series/bookshelf/directory chain continues.
      dispatch(openBook({ path: book.filePath, origin }));
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
    [dispatch, origin, showNotification, t],
  );

  const trigger = useCallback(
    async (direction: Direction) => {
      if (mode === "off" || isResolving.current || pending) {
        return;
      }
      isResolving.current = true;
      try {
        const adjacent = await resolveAdjacentBook(
          book,
          currentPath,
          origin,
          direction,
          fileNavigatorSortOrder,
        );
        if (!adjacent) {
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
          setPending({ book: adjacent, direction });
        } else {
          openAdjacentBook(adjacent, direction);
        }
      } catch (e) {
        error(`Failed to open the adjacent book: ${String(e)}`);
        showNotification(t("book-reader.adjacent-book.error"), "error");
      } finally {
        isResolving.current = false;
      }
    },
    [
      mode,
      pending,
      book,
      currentPath,
      origin,
      fileNavigatorSortOrder,
      showNotification,
      t,
      openAdjacentBook,
    ],
  );

  const onForwardBoundary = useCallback(() => {
    void trigger("next");
  }, [trigger]);

  const onBackwardBoundary = useCallback(() => {
    void trigger("previous");
  }, [trigger]);

  const confirmPending = useCallback(() => {
    if (pending) {
      openAdjacentBook(pending.book, pending.direction);
    }
    setPending(null);
  }, [pending, openAdjacentBook]);

  const cancelPending = useCallback(() => {
    setPending(null);
  }, []);

  return { onForwardBoundary, onBackwardBoundary, pending, confirmPending, cancelPending };
};
