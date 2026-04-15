import { useEffect } from "react";
import { useAppDispatch } from "../../../store/store";
import { fetchBookshelves } from "../slice";

/**
 * A custom hook that automatically fetches all bookshelves when the component mounts.
 *
 * This hook dispatches the `fetchBookshelves` action to initialize the bookshelf data
 * in the Redux store. It does not return any state directly; use `useAppSelector` in
 * components to access the fetched bookshelves.
 */
export function useBookshelves() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const initialize = async () => {
      dispatch(fetchBookshelves());
    };
    initialize();
  }, [dispatch]);
}
