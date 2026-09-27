import { configureStore } from "@reduxjs/toolkit";
import {
  useSelector as rawUseSelector,
  type TypedUseSelectorHook,
  useDispatch,
  useStore,
} from "react-redux";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { createReadingStateMiddleware } from "./middleware/readingStateMiddleware";
import { rootReducer } from "./rootReducer";

export type RootState = ReturnType<typeof rootReducer>;

export const createStore = (preloadedState?: Partial<RootState>) => {
  const readingState = createReadingStateMiddleware();
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(readingState.middleware).concat(loggerMiddleware),
  });
  // The flush rides on the store so whoever closes the window can reach it.
  return Object.assign(store, { flushReadingState: readingState.flush });
};

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore["dispatch"];

export const useAppSelector: TypedUseSelectorHook<RootState> = rawUseSelector;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppStore = () => useStore() as AppStore;
