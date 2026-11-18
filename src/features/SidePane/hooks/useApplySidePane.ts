import { useCallback } from "react";
import { useAppDispatch } from "../../../store/store";
import type { AppSettings } from "../../../types/AppSettings";
import { setSidePane, updateSettings } from "../../Settings/slice";

/**
 * Shows, hides or switches the side pane and saves it to the settings.
 *
 * @returns A function that applies a side-pane state.
 */
export const useApplySidePane = (): ((sidePane: AppSettings["layout"]["sidePane"]) => void) => {
  const dispatch = useAppDispatch();
  return useCallback(
    (sidePane: AppSettings["layout"]["sidePane"]) => {
      // Optimistic: the pane moves on this input, not after the IPC round-trip.
      dispatch(setSidePane(sidePane));
      dispatch(updateSettings({ key: "layout", value: { sidePane } }));
    },
    [dispatch],
  );
};
