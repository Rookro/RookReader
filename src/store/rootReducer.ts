import { combineReducers } from "@reduxjs/toolkit";
import BookmarkReducer from "../features/BookReader/bookmarkSlice";
import ReadReducer from "../features/BookReader/slice";
import SeriesReducer from "../features/Bookshelf/seriesSlice";
import CollectionReducer from "../features/Bookshelf/slice";
import TagReducer from "../features/Bookshelf/tagSlice";
import HistoryReducer from "../features/History/slice";
import ViewReducer from "../features/MainView/slice";
import SettingsErrorReducer from "../features/Settings/errorSlice";
import SettingsReducer from "../features/Settings/slice";

export const rootReducer = combineReducers({
  read: ReadReducer,
  bookmark: BookmarkReducer,
  view: ViewReducer,
  history: HistoryReducer,
  collection: CollectionReducer,
  tag: TagReducer,
  series: SeriesReducer,
  settings: SettingsReducer,
  settingsError: SettingsErrorReducer,
});
