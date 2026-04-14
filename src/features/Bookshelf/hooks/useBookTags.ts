import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { fetchTags } from "../slice";

/**
 * A custom hook that fetches book tags on initialization and returns the current tag state.
 *
 * This hook automatically dispatches the `fetchTags` action when the component mounts.
 * It selects and returns the tag fetching status, the array of tags, and any potential
 * errors from the Redux store.
 *
 * @returns An object containing:
 *  - `status`: The current loading status ("idle" | "loading" | "succeeded" | "failed").
 *  - `tags`: An array of Tag objects.
 *  - `error`: An error message string if the fetch failed, or null.
 */
export function useBookTags() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.bookCollection.tag.status);
  const tags = useAppSelector((state) => state.bookCollection.tag.tags);
  const error = useAppSelector((state) => state.bookCollection.tag.error);

  useEffect(() => {
    const initialize = async () => {
      dispatch(fetchTags());
    };
    initialize();
  }, [dispatch]);

  return { status, tags, error };
}
