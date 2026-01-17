import { configureStore } from "@reduxjs/toolkit";
import { useSelector as rawUseSelector, TypedUseSelectorHook, useDispatch } from "react-redux";
import FileReducer from "./reducers/FileReducer";
import ViewReducer from "./reducers/ViewReducer";
import HistoryReducer from "./reducers/HistoryReducer";
import { historyMiddleware } from "./middleware/historyMiddleware";
import SidePaneReducer from "./reducers/SidePaneReducer";

export const store = configureStore({
  reducer: {
    file: FileReducer,
    view: ViewReducer,
    history: HistoryReducer,
    sidePane: SidePaneReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(historyMiddleware),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export const useAppSelector: TypedUseSelectorHook<RootState> = rawUseSelector;
export const useAppDispatch = () => useDispatch<AppDispatch>();
