import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { useSelector as rawUseSelector, TypedUseSelectorHook, useDispatch } from "react-redux";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { readingStateMiddleware } from "./middleware/readingStateMiddleware";
import HistoryReducer from "./reducers/HistoryReducer";
import ReadReducer from "./reducers/ReadReducer";
import SidePaneReducer from "./reducers/SidePaneReducer";
import ViewReducer from "./reducers/ViewReducer";
import BookCollectionReducer from "./reducers/BookCollectionReducer";
import SettingsReducer from "./reducers/SettingsReducer";

const rootReducer = combineReducers({
  read: ReadReducer,
  view: ViewReducer,
  sidePane: SidePaneReducer,
  history: HistoryReducer,
  bookCollection: BookCollectionReducer,
  settings: SettingsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const createStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(readingStateMiddleware).concat(loggerMiddleware),
  });

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore["dispatch"];

export const useAppSelector: TypedUseSelectorHook<RootState> = rawUseSelector;
export const useAppDispatch = () => useDispatch<AppDispatch>();
