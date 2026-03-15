import { configureStore } from "@reduxjs/toolkit";
import { useSelector as rawUseSelector, TypedUseSelectorHook, useDispatch } from "react-redux";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { readingStateMiddleware } from "./middleware/readingStateMiddleware";
import HistoryReducer from "./reducers/HistoryReducer";
import ReadReducer from "./reducers/ReadReducer";
import SidePaneReducer from "./reducers/SidePaneReducer";
import ViewReducer from "./reducers/ViewReducer";
import BookCollectionReducer from "./reducers/BookCollectionReducer";

export const store = configureStore({
  reducer: {
    read: ReadReducer,
    view: ViewReducer,
    sidePane: SidePaneReducer,
    history: HistoryReducer,
    bookCollection: BookCollectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(readingStateMiddleware).concat(loggerMiddleware),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export const useAppSelector: TypedUseSelectorHook<RootState> = rawUseSelector;
export const useAppDispatch = () => useDispatch<AppDispatch>();
