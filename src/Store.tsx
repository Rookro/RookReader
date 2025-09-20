import { configureStore } from "@reduxjs/toolkit";
import { useSelector as rawUseSelector, TypedUseSelectorHook } from 'react-redux';
import FileReducer from "./reducers/FileReducer";
import ViewReducer from "./reducers/ViewReducer";

export const store = configureStore({
    reducer: {
        file: FileReducer,
        view: ViewReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
        })
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export const useSelector: TypedUseSelectorHook<RootState> = rawUseSelector;
