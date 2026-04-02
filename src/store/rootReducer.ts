import { combineReducers } from "@reduxjs/toolkit";
import HistoryReducer from "../features/History/slice";
import ReadReducer from "../features/BookReader/slice";
import SidePaneReducer from "../features/SidePane/slice";
import ViewReducer from "../features/MainView/slice";
import BookCollectionReducer from "../features/Bookshelf/slice";
import SettingsReducer from "../features/Settings/slice";

export const rootReducer = combineReducers({
  read: ReadReducer,
  view: ViewReducer,
  sidePane: SidePaneReducer,
  history: HistoryReducer,
  bookCollection: BookCollectionReducer,
  settings: SettingsReducer,
});
