import { combineReducers } from "@reduxjs/toolkit";
import ReadReducer from "../features/BookReader/slice";
import BookCollectionReducer from "../features/Bookshelf/slice";
import HistoryReducer from "../features/History/slice";
import ViewReducer from "../features/MainView/slice";
import SettingsReducer from "../features/Settings/slice";
import SidePaneReducer from "../features/SidePane/slice";

export const rootReducer = combineReducers({
  read: ReadReducer,
  view: ViewReducer,
  sidePane: SidePaneReducer,
  history: HistoryReducer,
  bookCollection: BookCollectionReducer,
  settings: SettingsReducer,
});
