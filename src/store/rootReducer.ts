import { combineReducers } from "@reduxjs/toolkit";
import ReadReducer from "../features/BookReader/slice";
import SeriesReducer from "../features/Bookshelf/seriesSlice";
import BookCollectionReducer from "../features/Bookshelf/slice";
import TagReducer from "../features/Bookshelf/tagSlice";
import HistoryReducer from "../features/History/slice";
import ViewReducer from "../features/MainView/slice";
import SettingsReducer from "../features/Settings/slice";

export const rootReducer = combineReducers({
  read: ReadReducer,
  view: ViewReducer,
  history: HistoryReducer,
  bookCollection: BookCollectionReducer,
  tag: TagReducer,
  series: SeriesReducer,
  settings: SettingsReducer,
});
