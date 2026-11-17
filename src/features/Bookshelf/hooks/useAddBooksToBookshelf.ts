import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { formatErrorReason } from "../../../components/ui/errorMessages";
import { useNotification } from "../../../components/ui/Notification/NotificationContext";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { addBooksToBookshelf } from "../slice";

/**
 * Adds books to the collection shown and tells the user how it went.
 *
 * @returns A function taking the paths to add; it resolves once the result is shown.
 */
export function useAddBooksToBookshelf() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const collectionId = useAppSelector((state) => state.collection.selectedId);
  const { showNotification } = useNotification();

  return useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) {
        return;
      }
      const action = await dispatch(addBooksToBookshelf({ collectionId, paths }));
      // A rejection of the whole request is shown by ErrorNotifier.
      if (!addBooksToBookshelf.fulfilled.match(action)) {
        return;
      }
      const { added, failures } = action.payload;
      if (failures.length === 0) {
        showNotification(t("bookshelf.book-addition.result.added", { count: added }));
        return;
      }
      const headline =
        added === 0
          ? t("bookshelf.book-addition.result.none-added", { count: failures.length })
          : t("bookshelf.book-addition.result.partly-added", {
              added,
              total: added + failures.length,
            });
      const reasons = new Set(failures.map((code) => formatErrorReason(t, code)));
      showNotification([headline, ...reasons].join("\n"), "error");
    },
    [collectionId, dispatch, showNotification, t],
  );
}
