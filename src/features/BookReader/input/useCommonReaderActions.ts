import { useAppDispatch, useAppSelector } from "../../../store/store";
import { updateSettings } from "../../Settings/slice";
import { useApplySidePane } from "../../SidePane/hooks/useApplySidePane";
import { useBookmarkToggle } from "../hooks/useBookmarkToggle";
import { toggleReadingDirection, toggleSpreadShift } from "../slice";
import type { CommonAction } from "./bindings";

/**
 * The reader view's shortcut actions, each doing what its toolbar or side-tab button does.
 * Spread and direction act on comics only.
 *
 * @returns The action for each common binding.
 */
export const useCommonReaderActions = (): Record<CommonAction, () => void> => {
  const dispatch = useAppDispatch();
  const isNovel = useAppSelector((state) => state.reader.isNovel);
  const enableSpread = useAppSelector((state) => state.settings.reader.comic.enableSpread);
  const { isHidden, tabIndex } = useAppSelector((state) => state.settings.layout.sidePane);
  const { toggle: toggleBookmark } = useBookmarkToggle();
  const applySidePane = useApplySidePane();

  return {
    toggleSpread: () => {
      if (!isNovel) {
        dispatch(
          updateSettings({ key: "reader", value: { comic: { enableSpread: !enableSpread } } }),
        );
      }
    },
    shiftSpread: () => {
      if (!isNovel && enableSpread) {
        dispatch(toggleSpreadShift());
      }
    },
    toggleDirection: () => {
      if (!isNovel) {
        dispatch(toggleReadingDirection());
      }
    },
    toggleBookmark,
    toggleSidePane: () => applySidePane({ isHidden: !isHidden, tabIndex }),
  };
};
